const { validateSchema, sanitizeString, sanitizeObject, schemas } = require('../middleware/requestValidator');

describe('Request Validator', () => {
    describe('sanitizeString', () => {
        test('should remove dangerous characters', () => {
            expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
            expect(sanitizeString('javascript:void(0)')).toBe('void(0)');
            expect(sanitizeString('onclick=alert(1)')).toBe('alert(1)');
        });

        test('should trim whitespace', () => {
            expect(sanitizeString('  hello  ')).toBe('hello');
        });

        test('should handle non-string input', () => {
            expect(sanitizeString(123)).toBe(123);
            expect(sanitizeString(null)).toBe(null);
        });
    });

    describe('sanitizeObject', () => {
        test('should sanitize nested objects', () => {
            const input = {
                name: '<script>test</script>',
                nested: {
                    value: 'onclick=bad'
                }
            };

            const result = sanitizeObject(input);
            expect(result.name).toBe('scripttest/script');
            expect(result.nested.value).toBe('bad');
        });

        test('should sanitize arrays', () => {
            const input = ['<test>', 'normal', 'javascript:bad'];
            const result = sanitizeObject(input);
            expect(result).toEqual(['test', 'normal', 'bad']);
        });
    });

    describe('validateSchema', () => {
        test('should validate required fields', () => {
            const schema = {
                name: { type: 'string', required: true }
            };

            expect(() => validateSchema({}, schema)).toThrow('Validation failed');
            expect(() => validateSchema({ name: 'test' }, schema)).not.toThrow();
        });

        test('should validate types', () => {
            const schema = {
                age: { type: 'number', required: true }
            };

            expect(() => validateSchema({ age: 'not a number' }, schema)).toThrow();
            expect(() => validateSchema({ age: 25 }, schema)).not.toThrow();
        });

        test('should validate min/max for numbers', () => {
            const schema = {
                score: { type: 'number', min: 0, max: 100, required: true }
            };

            expect(() => validateSchema({ score: -1 }, schema)).toThrow();
            expect(() => validateSchema({ score: 101 }, schema)).toThrow();
            expect(() => validateSchema({ score: 50 }, schema)).not.toThrow();
        });

        test('should validate enum values', () => {
            const schema = {
                category: { type: 'string', enum: ['sensor', 'metric'], required: true }
            };

            expect(() => validateSchema({ category: 'invalid' }, schema)).toThrow();
            expect(() => validateSchema({ category: 'sensor' }, schema)).not.toThrow();
        });

        test('should apply default values', () => {
            const schema = {
                limit: { type: 'number', default: 100 }
            };

            const result = validateSchema({}, schema);
            expect(result.limit).toBe(100);
        });
    });

    describe('createRecord schema', () => {
        test('should validate valid record', () => {
            const data = {
                value: 42.5,
                category: 'sensor'
            };

            expect(() => validateSchema(data, schemas.createRecord)).not.toThrow();
        });

        test('should reject invalid category', () => {
            const data = {
                value: 42.5,
                category: 'invalid'
            };

            expect(() => validateSchema(data, schemas.createRecord)).toThrow();
        });

        test('should reject out of range value', () => {
            const data = {
                value: 10001,
                category: 'sensor'
            };

            expect(() => validateSchema(data, schemas.createRecord)).toThrow();
        });
    });
});
