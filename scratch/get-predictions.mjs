// Use global fetch


async function run() {
  try {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`
      }
    });

    if (!res.ok) {
      console.error('Error fetching:', await res.text());
      return;
    }

    const data = await res.json();
    console.log('--- RECENT PREDICTIONS ---');
    for (const pred of data.results.slice(0, 10)) {
      console.log(`ID: ${pred.id}`);
      console.log(`Model: ${pred.model}`);
      console.log(`Version: ${pred.version}`);
      console.log(`Status: ${pred.status}`);
      console.log(`Created: ${pred.created_at}`);
      console.log(`Completed: ${pred.completed_at}`);
      console.log(`Error: ${pred.error}`);
      console.log(`Input: ${JSON.stringify(pred.input)}`);
      console.log(`Output: ${JSON.stringify(pred.output)}`);
      console.log('--------------------------');
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

run();
