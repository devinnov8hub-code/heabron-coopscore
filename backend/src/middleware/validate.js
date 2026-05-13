'use strict';

const { unprocessable, badRequest } = require('../utils/response');

/**
 * Validate a Joi schema against a request property (body/query/params).
 *   validate(schema, 'body')   // default
 *   validate(schema, 'query')
 */
function validate(schema, source = 'body') {
  return function (req, res, next) {
    if (!schema) return next();

    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return unprocessable(res, 'Validation failed', details);
    }

    req[source] = value;
    return next();
  };
}

function validateMany(specs) {
  return function (req, res, next) {
    for (const spec of specs) {
      const { error, value } = spec.schema.validate(req[spec.source], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
        return unprocessable(res, `Validation failed (${spec.source})`, details);
      }
      req[spec.source] = value;
    }
    return next();
  };
}

function requireParamUuid(name) {
  return function (req, res, next) {
    const v = req.params[name];
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!v || !uuidRe.test(v)) {
      return badRequest(res, `Invalid ${name}: must be a UUID`);
    }
    return next();
  };
}

module.exports = { validate, validateMany, requireParamUuid };
