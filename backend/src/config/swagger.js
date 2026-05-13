'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');

const SWAGGER_DIR = path.resolve(__dirname, '../../docs/swagger');

/**
 * Build a single OpenAPI document by reading the root `openapi.yaml`
 * (which uses $ref to load every path and schema from sibling files).
 */
function loadSpec() {
  const rootPath = path.join(SWAGGER_DIR, 'openapi.yaml');
  if (!fs.existsSync(rootPath)) {
    throw new Error(`OpenAPI root not found: ${rootPath}`);
  }
  const rootText = fs.readFileSync(rootPath, 'utf8');
  const root = YAML.parse(rootText);

  // Inline-include all schemas
  const schemaDir = path.join(SWAGGER_DIR, 'schemas');
  if (fs.existsSync(schemaDir)) {
    root.components = root.components || {};
    root.components.schemas = root.components.schemas || {};
    for (const file of fs.readdirSync(schemaDir)) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const obj = YAML.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8'));
      Object.assign(root.components.schemas, obj || {});
    }
  }

  // Inline-include all paths
  const pathDir = path.join(SWAGGER_DIR, 'paths');
  if (fs.existsSync(pathDir)) {
    root.paths = root.paths || {};
    for (const file of fs.readdirSync(pathDir)) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const obj = YAML.parse(fs.readFileSync(path.join(pathDir, file), 'utf8'));
      Object.assign(root.paths, obj || {});
    }
  }

  return root;
}

function mount(app, basePath = '/api/docs') {
  const spec = loadSpec();
  app.use(basePath, swaggerUi.serve, swaggerUi.setup(spec, {
    customSiteTitle: 'Heabron CoopScore API',
    customCssUrl: '/swagger-theme.css',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none', defaultModelsExpandDepth: 1 },
  }));
  app.get(`${basePath}.json`, (req, res) => res.json(spec));
  app.get(`${basePath}.yaml`, (req, res) => {
    res.setHeader('Content-Type', 'application/yaml');
    res.send(YAML.stringify(spec));
  });
}

module.exports = { loadSpec, mount };
