"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.createRedisClient = createRedisClient;
exports.isRedisConnected = isRedisConnected;
exports.isRedisReady = isRedisReady;
exports.getConnectionStatus = getConnectionStatus;
exports.getMetrics = getMetrics;
exports.resetMetrics = resetMetrics;
exports.disconnectRedis = disconnectRedis;
exports.isRedisHealthy = isRedisHealthy;
exports.getServerInfo = getServerInfo;
var ioredis_1 = require("ioredis");
/**
 * Singleton Redis client instance
 */
var client = null;
/**
 * Connection health metrics
 */
var connectionMetrics = {
    reconnectAttempts: 0,
    totalErrors: 0,
    commandsExecuted: 0,
    errors: [],
};
/**
 * Verbose logging flag
 */
var verboseLogging = false;
/**
 * Track if client is ready
 */
var isClientReady = false;
/**
 * If Redis is disabled via env, provide a no-op in-memory client to avoid
 * attempting network connections during builds or in environments without Redis.
 */
function createNoopClient() {
    var _this = this;
    var noop = {
        status: "ready",
        get: function (_) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, null];
        }); }); },
        set: function (_, __) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, "OK"];
        }); }); },
        setex: function (_, __, ___) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, "OK"];
        }); }); },
        del: function () {
            var _ = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _[_i] = arguments[_i];
            }
            return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, 0];
            }); });
        },
        keys: function (_) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, []];
        }); }); },
        exists: function (_) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, 0];
        }); }); },
        ttl: function (_) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, -2];
        }); }); },
        ping: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, "PONG"];
        }); }); },
        connect: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/];
        }); }); },
        disconnect: function () { },
        quit: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/];
        }); }); },
        on: function (_, __) { return noop; },
        off: function (_, __) { return noop; },
        sendCommand: function () {
            var _args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _args[_i] = arguments[_i];
            }
            return Promise.resolve();
        },
    };
    return noop;
}
/**
 * Get environment-aware default configuration
 */
function getDefaultConfig() {
    var env = process.env.NODE_ENV || "development";
    var isDev = env === "development";
    var isProd = env === "production";
    return {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || "0", 10),
        keyPrefix: process.env.REDIS_KEY_PREFIX || undefined,
        tls: process.env.REDIS_TLS === "true",
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST || "5", 10),
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || (isProd ? "10000" : "5000"), 10),
    };
}
/**
 * Log helper with verbose mode support
 */
function log(level, message, data) {
    var timestamp = new Date().toISOString();
    var prefix = "[Redis ".concat(timestamp, "]");
    switch (level) {
        case "info":
            if (verboseLogging) {
                console.log(prefix, message, data || "");
            }
            break;
        case "warn":
            console.warn(prefix, message, data || "");
            break;
        case "error":
            console.error(prefix, message, data || "");
            // Track errors in metrics (keep last 50)
            connectionMetrics.errors.push({
                timestamp: new Date(),
                error: typeof data === "string" ? data : JSON.stringify(data),
            });
            if (connectionMetrics.errors.length > 50) {
                connectionMetrics.errors.shift();
            }
            break;
    }
}
/**
 * Get or create the Redis client singleton
 *
 * @param config - Optional configuration to override defaults
 * @param options - Additional options like verbose logging
 */
function getRedisClient(config, options) {
    var _a, _b;
    if (client) {
        log("info", "Reusing existing Redis connection");
        return client;
    }
    // If Redis is disabled via environment, return a noop client to avoid
    // attempting to open network connections (useful during builds/tests).
    var redisEnabled = process.env.CACHE_REDIS_ENABLED === "true" ||
        process.env.REDIS_ENABLED === "true";
    if (!redisEnabled) {
        log("info", "Redis disabled by env; returning noop client");
        client = createNoopClient();
        isClientReady = false;
        return client;
    }
    // Set verbose logging
    verboseLogging = (_a = options === null || options === void 0 ? void 0 : options.verbose) !== null && _a !== void 0 ? _a : process.env.NODE_ENV === "development";
    var autoConnect = (_b = options === null || options === void 0 ? void 0 : options.autoConnect) !== null && _b !== void 0 ? _b : false;
    var defaultConfig = getDefaultConfig();
    var finalConfig = __assign(__assign({}, defaultConfig), config);
    log("info", "Creating Redis client for ".concat(finalConfig.host, ":").concat(finalConfig.port), {
        db: finalConfig.db,
        environment: process.env.NODE_ENV,
    });
    var maxRetries = process.env.NODE_ENV === "production" ? 10 : 5;
    var retryDelay = process.env.NODE_ENV === "production" ? 2000 : 1000;
    client = new ioredis_1.default({
        host: finalConfig.host,
        port: finalConfig.port,
        password: finalConfig.password,
        db: finalConfig.db,
        maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
        connectTimeout: finalConfig.connectTimeout,
        lazyConnect: !autoConnect,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        keyPrefix: finalConfig.keyPrefix,
        tls: finalConfig.tls ? {} : undefined,
        retryStrategy: function (times) {
            if (times > maxRetries) {
                log("error", "Failed to connect to Redis after ".concat(times, " attempts. Giving up."));
                return null; // Stop retrying
            }
            var delay = Math.min(times * 200, retryDelay);
            log("warn", "Retry attempt ".concat(times, " in ").concat(delay, "ms"));
            return delay;
        },
    });
    // Connection event handlers
    client.on("connect", function () {
        log("info", "Connected to ".concat(finalConfig.host, ":").concat(finalConfig.port));
    });
    client.on("ready", function () {
        isClientReady = true;
        connectionMetrics.connectedAt = new Date();
        log("info", "Redis client ready");
    });
    client.on("error", function (error) {
        connectionMetrics.lastErrorAt = new Date();
        connectionMetrics.totalErrors++;
        log("error", "Connection error: ".concat(error.message), error);
    });
    client.on("close", function () {
        isClientReady = false;
        log("warn", "Connection closed");
    });
    client.on("reconnecting", function (delay) {
        connectionMetrics.reconnectAttempts++;
        connectionMetrics.lastReconnectAt = new Date();
        log("info", "Reconnecting in ".concat(delay, "ms..."), {
            attempts: connectionMetrics.reconnectAttempts,
        });
    });
    client.on("end", function () {
        isClientReady = false;
        log("info", "Connection ended");
    });
    // Track commands executed
    var originalSendCommand = client.sendCommand;
    client.sendCommand = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        connectionMetrics.commandsExecuted++;
        return originalSendCommand.apply(this, args);
    };
    // Register graceful shutdown handlers
    registerShutdownHandlers();
    return client;
}
/**
 * Create a Redis client with auto-connect
 * Useful when you need to ensure connection before operations
 */
function createRedisClient(config, options) {
    return __awaiter(this, void 0, void 0, function () {
        var redisClient, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redisClient = getRedisClient(config, __assign(__assign({}, options), { autoConnect: false }));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redisClient.connect()];
                case 2:
                    _a.sent();
                    log("info", "Redis client connected and ready");
                    return [2 /*return*/, redisClient];
                case 3:
                    error_1 = _a.sent();
                    log("error", "Failed to connect Redis client", error_1);
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check if Redis client exists and is connected
 */
function isRedisConnected() {
    return client !== null && client.status === "ready";
}
/**
 * Check if Redis client is ready to accept commands
 */
function isRedisReady() {
    return isClientReady && client !== null && client.status === "ready";
}
/**
 * Get detailed connection status and health metrics
 */
function getConnectionStatus() {
    var defaultConfig = getDefaultConfig();
    return {
        connected: isRedisConnected(),
        ready: isRedisReady(),
        host: defaultConfig.host,
        port: defaultConfig.port,
        db: defaultConfig.db || 0,
        metrics: __assign({}, connectionMetrics),
        config: {
            keyPrefix: defaultConfig.keyPrefix,
            tls: defaultConfig.tls || false,
            environment: process.env.NODE_ENV || "development",
        },
    };
}
/**
 * Get connection health metrics
 */
function getMetrics() {
    return __assign({}, connectionMetrics);
}
/**
 * Reset connection metrics (useful for testing)
 */
function resetMetrics() {
    connectionMetrics = {
        reconnectAttempts: 0,
        totalErrors: 0,
        commandsExecuted: 0,
        errors: [],
    };
}
/**
 * Disconnect and cleanup the Redis client
 */
function disconnectRedis() {
    return __awaiter(this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!client) return [3 /*break*/, 4];
                    log("info", "Disconnecting Redis client...");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.quit()];
                case 2:
                    _a.sent();
                    client = null;
                    isClientReady = false;
                    log("info", "Redis disconnected and cleaned up");
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    log("error", "Error during disconnect", error_2);
                    // Force disconnect
                    if (client) {
                        client.disconnect();
                    }
                    client = null;
                    isClientReady = false;
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check if Redis is connected and healthy
 * Performs a PING command to verify connectivity
 */
function isRedisHealthy() {
    return __awaiter(this, void 0, void 0, function () {
        var pong, healthy, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!client || !isRedisConnected()) {
                        log("warn", "Health check failed: client not connected");
                        return [2 /*return*/, false];
                    }
                    return [4 /*yield*/, client.ping()];
                case 1:
                    pong = _a.sent();
                    healthy = pong === "PONG";
                    if (healthy) {
                        log("info", "Health check passed");
                    }
                    else {
                        log("warn", "Health check failed: unexpected response '".concat(pong, "'"));
                    }
                    return [2 /*return*/, healthy];
                case 2:
                    error_3 = _a.sent();
                    log("error", "Health check failed with exception", error_3);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get Redis server info
 * Returns parsed server information
 */
function getServerInfo() {
    return __awaiter(this, void 0, void 0, function () {
        var info, parsed_1, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!client || !isRedisConnected()) {
                        throw new Error("Redis client not connected");
                    }
                    return [4 /*yield*/, client.info()];
                case 1:
                    info = _a.sent();
                    parsed_1 = {};
                    info.split("\r\n").forEach(function (line) {
                        if (line && !line.startsWith("#")) {
                            var _a = line.split(":"), key = _a[0], value = _a[1];
                            if (key && value) {
                                parsed_1[key] = value;
                            }
                        }
                    });
                    return [2 /*return*/, parsed_1];
                case 2:
                    error_4 = _a.sent();
                    log("error", "Failed to get server info", error_4);
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Register graceful shutdown handlers for process termination
 * Ensures Redis connections are properly closed before exit
 */
var shutdownHandlersRegistered = false;
function registerShutdownHandlers() {
    var _this = this;
    if (shutdownHandlersRegistered || typeof process === "undefined") {
        return;
    }
    shutdownHandlersRegistered = true;
    var gracefulShutdown = function (signal) { return __awaiter(_this, void 0, void 0, function () {
        var error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log("info", "Received ".concat(signal, ", initiating graceful shutdown..."));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, disconnectRedis()];
                case 2:
                    _a.sent();
                    log("info", "Redis connection closed successfully");
                    process.exit(0);
                    return [3 /*break*/, 4];
                case 3:
                    error_5 = _a.sent();
                    log("error", "Error during graceful shutdown", error_5);
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    // Handle termination signals
    process.on("SIGTERM", function () { return gracefulShutdown("SIGTERM"); });
    process.on("SIGINT", function () { return gracefulShutdown("SIGINT"); });
    // Handle uncaught errors
    process.on("uncaughtException", function (error) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log("error", "Uncaught exception", error);
                    return [4 /*yield*/, disconnectRedis()];
                case 1:
                    _a.sent();
                    process.exit(1);
                    return [2 /*return*/];
            }
        });
    }); });
    process.on("unhandledRejection", function (reason) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log("error", "Unhandled rejection", reason);
                    return [4 /*yield*/, disconnectRedis()];
                case 1:
                    _a.sent();
                    process.exit(1);
                    return [2 /*return*/];
            }
        });
    }); });
    log("info", "Graceful shutdown handlers registered");
}
