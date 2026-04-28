import fetch from 'node-fetch';
import https from 'https';

const url = 'https://api.flare.tech/v1/chat/completions';
const key = 'sk-s9l7eu6kiBx1QiuSCxIJwZVid9PueaqffxOIWUrEI4NwO5IL';

async function test() {
  console.log('Testing connection to Flare...');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      agent: new https.Agent({ rejectUnauthorized: false }),
      body: JSON.stringify({
        model: 'glm-5',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      }),
    });
    console.log('Status:', response.status);

    const text = await response.text();
    console.log('Body:', text);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
