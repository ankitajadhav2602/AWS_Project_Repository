document.getElementById('incidentForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const data = {
    description: document.getElementById('description').value,
    severity: document.getElementById('severity').value,
    department: document.getElementById('department').value,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch('https://your-api-endpoint.com/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    document.getElementById('responseMessage').textContent = result.message || 'Incident submitted successfully!';
  } catch (error) {
    document.getElementById('responseMessage').textContent = 'Error submitting incident.';
    console.error(error);
  }
});
