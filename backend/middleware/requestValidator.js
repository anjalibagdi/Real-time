/**
 * Custom Request Validator Middleware
 * Schema-based validation and input sanitization
 * 
 * Features:
 * - Type validation
 * - Required field checking
 * - Input sanitization to prevent injection attacks
 * - Custom validation rules
 * - No third-party dependencies
 */

class ValidationError extends Error {
    constructor(message, errors) {
        super(message);
        this.name = 'ValidationError';
        this.errors = errors;
        this.statusCode = 400;
    }
}

/**
 * Sanitize string input to prevent injection attacks
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;

    // Remove potentially dangerous characters
    return str
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj) {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = sanitizeString(key);
            sanitized[sanitizedKey] = sanitizeObject(value);
        }
        return sanitized;
    }

    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    return obj;
}

/**
 * Validate field against schema rules
 */
function validateField(fieldName, value, rules) {
    const errors = [];

    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${fieldName} is required`);
        return errors;
    }

    // Skip further validation if field is optional and not provided
    if (!rules.required && (value === undefined || value === null)) {
        return errors;
    }

    // Type validation
    if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (rules.type === 'number' && actualType !== 'number') {
            errors.push(`${fieldName} must be a number`);
        } else if (rules.type === 'string' && actualType !== 'string') {
            errors.push(`${fieldName} must be a string`);
        } else if (rules.type === 'boolean' && actualType !== 'boolean') {
            errors.push(`${fieldName} must be a boolean`);
        } else if (rules.type === 'array' && !Array.isArray(value)) {
            errors.push(`${fieldName} must be an array`);
        } else if (rules.type === 'object' && (actualType !== 'object' || Array.isArray(value))) {
            errors.push(`${fieldName} must be an object`);
        }
    }

    // Min/Max validation for numbers
    if (rules.type === 'number' && typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
            errors.push(`${fieldName} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
            errors.push(`${fieldName} must be at most ${rules.max}`);
        }
    }

    // Length validation for strings
    if (rules.type === 'string' && typeof value === 'string') {
        if (rules.minLength !== undefined && value.length < rules.minLength) {
            errors.push(`${fieldName} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
            errors.push(`${fieldName} must be at most ${rules.maxLength} characters`);
        }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${fieldName} must be one of: ${rules.enum.join(', ')}`);
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string') {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(value)) {
            errors.push(`${fieldName} format is invalid`);
        }
    }

    // Custom validation function
    if (rules.validate && typeof rules.validate === 'function') {
        const customError = rules.validate(value);
        if (customError) {
            errors.push(customError);
        }
    }

    return errors;
}

/**
 * Validate request body against schema
 */
function validateSchema(data, schema) {
    const errors = [];
    const validatedData = {};

    // Check all schema fields
    for (const [fieldName, rules] of Object.entries(schema)) {
        const value = data[fieldName];
        const fieldErrors = validateField(fieldName, value, rules);

        if (fieldErrors.length > 0) {
            errors.push(...fieldErrors);
        } else if (value !== undefined) {
            // Apply default value if not provided
            validatedData[fieldName] = value !== undefined ? value : rules.default;
        } else if (rules.default !== undefined) {
            validatedData[fieldName] = rules.default;
        }
    }

    // Check for unknown fields if strict mode
    if (schema._strict) {
        const schemaKeys = Object.keys(schema).filter(k => !k.startsWith('_'));
        const dataKeys = Object.keys(data);
        const unknownFields = dataKeys.filter(k => !schemaKeys.includes(k));

        if (unknownFields.length > 0) {
            errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
        }
    }

    if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors);
    }

    return validatedData;
}

/**
 * Validation schemas for different endpoints
 */
const schemas = {
    createRecord: {
        value: {
            type: 'number',
            required: true,
            min: 0,
            max: 10000
        },
        category: {
            type: 'string',
            required: true,
            enum: ['sensor', 'metric', 'event', 'alert', 'system']
        },
        metadata: {
            type: 'object',
            required: false
        },
        _strict: true
    },

    getRecords: {
        limit: {
            type: 'number',
            required: false,
            min: 1,
            max: 1000,
            default: 100
        },
        skip: {
            type: 'number',
            required: false,
            min: 0,
            default: 0
        },
        category: {
            type: 'string',
            required: false,
            enum: ['sensor', 'metric', 'event', 'alert', 'system']
        }
    }
};

/**
 * Express middleware factory
 */
function createValidator(schemaName) {
    return (req, res, next) => {
        try {
            const schema = schemas[schemaName];

            if (!schema) {
                throw new Error(`Schema '${schemaName}' not found`);
            }

            // Determine which data to validate
            let dataToValidate;
            if (req.method === 'GET' || req.method === 'DELETE') {
                dataToValidate = req.query;
            } else {
                dataToValidate = req.body;
            }

            // Sanitize input
            const sanitizedData = sanitizeObject(dataToValidate);

            // Validate against schema
            const validatedData = validateSchema(sanitizedData, schema);

            // Attach validated data to request
            req.validated = validatedData;

            next();
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: error.message,
                    details: error.errors
                });
            }

            // Unexpected error
            console.error('Validation middleware error:', error);
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'An error occurred during validation'
            });
        }
    };
}

module.exports = {
    createValidator,
    validateSchema,
    sanitizeString,
    sanitizeObject,
    schemas,
    ValidationError
};
