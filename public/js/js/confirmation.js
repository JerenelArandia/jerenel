document.addEventListener("DOMContentLoaded", () => {
  const displayContainer = document.getElementById("confirmation-display");
  const searchInput = document.getElementById("search-ref");
  const lookupBtn = document.getElementById("lookup-btn");

  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref");

  if (refCode) {
    searchInput.value = refCode;
    fetchBookingDetails(refCode);
  }

  lookupBtn.addEventListener("click", () => {
    const code = searchInput.value.trim();
    if (code) {
      fetchBookingDetails(code);
    }
  });

  async function fetchBookingDetails(ref) {
    displayContainer.innerHTML = "<p style='text-align: center; color: var(--text-muted);'>Fetching booking details...</p>";

    try {
      const res = await fetch(`/api/bookings/reference/${ref}`);
      const data = await res.json();

      if (!res.ok) {
        displayContainer.innerHTML = `<div class="confirmation-card" style="border-color: var(--danger-color);"><p style="color: var(--danger-color);">${data.error}</p></div>`;
        return;
      }

      const serviceName = data.services ? data.services.name : "N/A";
      const price = data.services ? `₱${parseFloat(data.services.price).toFixed(2)}` : "N/A";

      displayContainer.innerHTML = `
        <div class="confirmation-card">
          <h2 style="color: var(--accent-green);">Booking Confirmed!</h2>
          <p style="color: var(--text-muted);">Save your reference number for repair verification:</p>
          <div class="ref-badge">${data.reference}</div>

          <div class="details-list">
            <div class="details-row"><span>Status</span><span style="color: ${getStatusColor(data.status)}; text-transform: uppercase;">${data.status}</span></div>
            <div class="details-row"><span>Client Name</span><span>${data.name}</span></div>
            <div class="details-row"><span>Service</span><span>${serviceName}</span></div>
            <div class="details-row"><span>Cost</span><span style="color: var(--accent-green);">${price}</span></div>
            <div class="details-row"><span>Date</span><span>${data.booking_date}</span></div>
            <div class="details-row"><span>Time</span><span>${data.booking_time}</span></div>
            <div class="details-row"><span>Contact</span><span>${data.contact}</span></div>
            <div class="details-row"><span>Email</span><span>${data.email}</span></div>
            ${data.notes ? `<div class="details-row"><span>Notes</span><span>${data.notes}</span></div>` : ""}
          </div>

          <button onclick="window.print()" class="btn btn-secondary">Print Details</button>
        </div>
      `;
    } catch (err) {
      displayContainer.innerHTML = `<div class="confirmation-card" style="border-color: var(--danger-color);"><p style="color: var(--danger-color);">Failed to fetch details. Please try again.</p></div>`;
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case "confirmed": return "var(--accent-green)";
      case "cancelled": return "var(--danger-color)";
      default: return "var(--accent-blue)";
    }
  }
});