import { Prisma } from '@prisma/client';
import { FieldEncryption } from './encryption';

/**
 * Map of [ModelName] -> [FieldName] -> 'deterministic' | 'randomized'
 */
const ENCRYPTED_FIELDS: Record<string, Record<string, 'deterministic' | 'randomized'>> = {
  User: {
    phone: 'deterministic',
  },
  ClientProfile: {
    kraPin: 'deterministic',
  },
  ProfessionalProfile: {
    kraPin: 'deterministic',
  },
  Store: {
    mpesaTillNumber: 'randomized',
    mpesaPaybill: 'randomized',
    mpesaPasskey: 'randomized',
  },
  ProfessionalLicense: {
    licenseNumber: 'deterministic', // Searchable/Unique
  },
  Property: {
    titleDeedNumber: 'randomized', // Assuming not searched often by public
  }
};

/**
 * Traverse object and encrypt fields defined in ENCRYPTED_FIELDS
 */
function encryptParams(model: string, data: any) {
  if (!data || typeof data !== 'object') return;
  
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return;

  for (const [key, value] of Object.entries(data)) {
    if (fields[key] && typeof value === 'string') {
      data[key] = fields[key] === 'deterministic' 
        ? FieldEncryption.encryptDeterministic(value)
        : FieldEncryption.encryptRandomized(value);
    } else if (typeof value === 'object') {
      encryptParams(model, value); // Recurse for nested writes (e.g. create with connect)
    }
  }
}

/**
 * Encrypt values in 'where' clause for deterministic fields
 */
function encryptWhere(model: string, where: any) {
  if (!where || typeof where !== 'object') return;

  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return;

  for (const [key, value] of Object.entries(where)) {
    // Only encrypt if deterministic field. Randomized fields cannot be searched this way.
    if (fields[key] === 'deterministic' && typeof value === 'string') {
        where[key] = FieldEncryption.encryptDeterministic(value);
    } else if (typeof value === 'object' && value !== null) {
       // Recursion required for { kraPin: { equals: '...' } }
       // But be careful not to encrypt operators like `contains` which won't work.
       // Only exact match works for deterministic.
        if (fields[key] === 'deterministic' && 'equals' in value && typeof value.equals === 'string') {
             value.equals = FieldEncryption.encryptDeterministic(value.equals);
        } else if (fields[key] === 'deterministic' && 'in' in value && Array.isArray(value.in)) {
             value.in = value.in.map((v: any) => typeof v === 'string' ? FieldEncryption.encryptDeterministic(v) : v);
        }
        // Nested AND/OR
        encryptWhere(model, value);
    }
  }
}

/**
 * Traverse result and decrypt fields
 */
function decryptResult(model: string, data: any) {
  if (!data || typeof data !== 'object' || data === null) return;
  
  const fields = ENCRYPTED_FIELDS[model];
  
  if (Array.isArray(data)) {
    data.forEach(item => decryptResult(model, item));
    return;
  }

  // If fields exist for this model, decrypt them
  if (fields) {
    for (const field of Object.keys(fields)) {
      if (data[field] && typeof data[field] === 'string') {
        data[field] = FieldEncryption.decrypt(data[field]);
      }
    }
  }
  
  // Recursion for relations? 
  // e.g. User.professionalProfile.kraPin
  // This requires mapping relation names to models.
  // We'll handle basic common relations manually or generic traversal if keys match known relations.
  // For safety/perf, we only decrypt top-level of the requested model in this simplified version,
  // OR we traverse all keys and if object looks like a model (has known fields), we try.
  // But strict typing is hard here.
  // We will iterate all keys, if value is object/array, we recurse? 
  // No, that's expensive.
  // We'll rely on the fact that 'model' arg in extension is the root model.
  // Decrypting nested relations requires knowing the model of the relation.
  // For now, we only handle the primary model's fields.
  // TODO: Add support for nested relation decryption map.
}

export const encryptionExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model) return (query as any)(args);

          // 1. Encrypt Write Data
          if (['create', 'update', 'upsert', 'createMany'].includes(operation)) {
             if ((args as any).data) {
                // Determine actual data object(s)
                const data = (args as any).data;
                if (Array.isArray(data)) {
                    data.forEach(d => encryptParams(model, d));
                } else {
                    encryptParams(model, data);
                }
             }
          }

          // 2. Encrypt Search Params (Where)
          if ((args as any).where) {
            encryptWhere(model, (args as any).where);
          }

          // 3. Execute Query
          const result = await (query as any)(args);

          // 4. Decrypt Result
          decryptResult(model, result);

          return result;
        },
      },
    },
  });
});
