function renderAdminDashboard() {
  const unpaidContainer = document.getElementById("unpaid-jobs");
  const paidContainer = document.getElementById("paid-jobs");

  unpaidContainer.innerHTML = "";
  paidContainer.innerHTML = "";

  const jobs = state.jobs.filter((j) => j.isComplete && j.paymentStatus === "paid");

  for (const job of jobs) {
    const hustler = state.users.find((u) => u.id === job.acceptedHustlerId);
    const payout = `$${job.hustlerPayoutAmount / 100 || 0}`;

    const card = document.createElement("div");
    card.className = "job-card";
    card.innerHTML = `
      <p><strong>Job:</strong> ${job.title}</p>
      <p><strong>Hustler:</strong> ${hustler?.name || "Unknown"}</p>
      <p><strong>Preferred Payment:</strong> ${hustler?.paymentPreference || "N/A"}</p>
      <p><strong>Amount Owed:</strong> ${payout}</p>
    `;

    if (!job.adminPayoutDone) {
      const button = document.createElement("button");
      button.textContent = "Mark as Paid";
      button.onclick = () => {
        job.adminPayoutDone = true;
        saveState();
        renderAdminDashboard();
      };
      card.appendChild(button);
      unpaidContainer.appendChild(card);
    } else {
      paidContainer.appendChild(card);
    }
  }
}

renderAdminDashboard();
