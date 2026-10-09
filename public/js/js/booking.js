document.addEventListener("DOMContentLoaded", async () => {
  const serviceSelect = document.getElementById("service_id");
  const form = document.getElementById("booking-form");

  // Read URL params for pre-selected service
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedServiceId = urlParams.get("service_id");

  // Restrict past dates in date picker
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("booking_date").setAttribute("min", today);

  // Fetch active services to populate dropdown
  try {
    const res = await fetch("/api/services");
    if (res.ok) {
      const services = await res.json();
      services.forEach(service => {
        const option = document.createElement("option");
        option.value = service.id;
        option.textContent = `${service.name} - ₱${parseFloat(service.price).toFixed(2)}`;
        if (preselectedServiceId && service.id === preselectedServiceId) {
          option.selected = true;
        }
        serviceSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Error populating service dropdown:", err);
  }

  // Handle booking form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to submit booking.");
        return;
      }

      // Redirect to confirmation page with reference code
      window.location.href = `/confirmation.html?ref=${result.reference}`;
    } catch (err) {
      alert("An unexpected error occurred. Please try again.");
    }
  });
});