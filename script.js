document.getElementById('incidentForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    name: document.getElementById('name').value,
    description: document.getElementById('description').value,
    severity: document.getElementById('severity').value
  };

  try {
    const response = await fetch('/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    alert(result.message);
  } catch (error) {
    alert('Error submitting incident');
  }
});
