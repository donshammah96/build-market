export const validateEmail = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return 'Email is required';
    if (trimmed.length > 254) return 'Email is too long';
    // Basic RFC 5322-like check with additional subdomain support
    const emailRegex = /^(?=.{1,254}$)(?=.{1,64}@)[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
    return emailRegex.test(trimmed) ? '' : 'Invalid email format';
  };
  
  export const validatePassword = (value: string): string => {
    const pass = value || '';
    if (pass.length < 8) return 'Password must be at least 8 characters';
    if (pass.length > 128) return 'Password must be at most 128 characters';
    if (!/[a-z]/.test(pass)) return 'Include at least one lowercase letter';
    if (!/[A-Z]/.test(pass)) return 'Include at least one uppercase letter';
    if (!/\d/.test(pass)) return 'Include at least one number';
    if (!/[^A-Za-z0-9]/.test(pass)) return 'Include at least one symbol';
    if (/\s/.test(pass)) return 'No spaces allowed in password';
    return '';
  };

export const validateConfirmPassword = (password: string, confirmPassword: string): string => {
    if (!confirmPassword) return 'Please confirm your password';
    return password === confirmPassword ? '' : 'Passwords do not match';
  };