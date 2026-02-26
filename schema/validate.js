/**
 * schema/validate.js — KATHA schema validation utility
 *
 * Validates Cultural Memory Passport and Living Memory Object
 * data against their JSON Schema definitions using Ajv.
 */

const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const path = require("path");
const fs = require("fs");

// Load schemas from disk
const passportSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "cultural-memory-passport-v1.json"), "utf8")
);
const lmoSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "living-memory-object-v1.json"), "utf8")
);
const triggerSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "situational-trigger-taxonomy.json"), "utf8")
);

// Configure Ajv with JSON Schema 2020-12 support
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Register the LMO schema so the passport's $ref can resolve it
ajv.addSchema(lmoSchema, "living-memory-object-v1.json");
ajv.addSchema(triggerSchema, "situational-trigger-taxonomy.json");

// Compile validators
const _validatePassport = ajv.compile(passportSchema);
const _validateLMO = ajv.compile(lmoSchema);

/**
 * Format Ajv errors into human-readable strings.
 * @param {import("ajv").ErrorObject[] | null | undefined} errors
 * @returns {string[]}
 */
function formatErrors(errors) {
  if (!errors || errors.length === 0) return [];
  return errors.map((err) => {
    const location = err.instancePath || "(root)";
    return `${location}: ${err.message}`;
  });
}

/**
 * Validate a Cultural Memory Passport object.
 * @param {object} data - The passport data to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePassport(data) {
  const valid = _validatePassport(data);
  return {
    valid: !!valid,
    errors: formatErrors(_validatePassport.errors),
  };
}

/**
 * Validate a Living Memory Object.
 * @param {object} data - The LMO data to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLMO(data) {
  const valid = _validateLMO(data);
  return {
    valid: !!valid,
    errors: formatErrors(_validateLMO.errors),
  };
}

module.exports = { validatePassport, validateLMO };
