// script.js

document.getElementById('incidentForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  // Collect form data
  const data = {
    name: document.getElementById('name').value.trim(),
    description: document.getElementById('description').value.trim(),
    severity: document.getElementById('severity').value
  };

  // Basic validation
  if (!data.name || !data.description || !data.severity) {
    alert('Please fill out all fields.');
    return;
  }

  try {
    // Send data to backend
    const response = await fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      alert('✅ Incident submitted successfully!');
      document.getElementById('incidentForm').reset();
    } else {
      alert('❌ Failed to submit incident. Please try again.');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('⚠️ Server error. Please check your connection.');
  }
});
