/**
 * test-step10.js – Docker & Containerisation
 * Checks that docker-compose.yml and Dockerfile exist and are valid,
 * then optionally pings the containerised server if DOCKER_TEST=1.
 */

const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Step 10: Docker & Containerisation ===\n');

  assert(fs.existsSync('./Dockerfile'),          'Dockerfile exists');
  assert(fs.existsSync('./docker-compose.yml'),  'docker-compose.yml exists');

  const dockerfile = fs.readFileSync('./Dockerfile', 'utf8');
  assert(dockerfile.includes('node'),            'Dockerfile uses Node base image');
  assert(dockerfile.includes('npm install'),     'Dockerfile runs npm install');
  assert(dockerfile.includes('EXPOSE 3000'),     'Dockerfile exposes port 3000');

  const compose = fs.readFileSync('./docker-compose.yml', 'utf8');
  assert(compose.includes('app'),                'docker-compose has "app" service');
  assert(compose.includes('ollama'),             'docker-compose has "ollama" service');
  assert(compose.includes('3000:3000'),          'app service maps port 3000');
  assert(compose.includes('11434'),              'ollama service maps port 11434');
  assert(compose.includes('./data'),             'Persistent volume for block data');

  if (process.env.DOCKER_TEST === '1') {
    const BASE = process.env.SERVER_URL || 'http://localhost:3000';
    console.log(`\n  Testing live container at ${BASE}...`);
    const res = await fetch(`${BASE}/api/chain`);
    assert(res.ok, 'Containerised server responds on /api/chain');
  } else {
    console.log('\n  → To test live: docker-compose up -d && DOCKER_TEST=1 node test-step10.js');
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(console.error);
