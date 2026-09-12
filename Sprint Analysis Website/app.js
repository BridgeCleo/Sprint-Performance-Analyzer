const state = {
  mode: "single",
  files: [null, null],
  analyses: [],
  charts: [],
};

const phaseColors = {
  start: "rgba(4, 154, 154, 0.10)",
  accel: "rgba(184, 217, 54, 0.13)",
  max: "rgba(244, 189, 63, 0.16)",
  decel: "rgba(242, 100, 75, 0.12)",
};

const dataColors = ["#049a9a", "#f2644b"];
const dataFills = ["rgba(4, 154, 154, 0.08)", "rgba(242, 100, 75, 0.08)"];

const els = {
  modeButtons: document.querySelectorAll(".mode-button"),
  dropZones: document.querySelectorAll(".drop-zone"),
  inputs: document.querySelectorAll(".file-input"),
  secondaryUpload: document.querySelector(".secondary-upload"),
  analyzeButton: document.getElementById("analyzeButton"),
  clearButton: document.getElementById("clearButton"),
  uploadHint: document.getElementById("uploadHint"),
  notice: document.getElementById("notice"),
  validation: document.getElementById("validation"),
  validationGrid: document.getElementById("validationGrid"),
  results: document.getElementById("results"),
  resultsIntro: document.getElementById("resultsIntro"),
  summaryGrid: document.getElementById("summaryGrid"),
  phaseGrid: document.getElementById("phaseGrid"),
  chartsGrid: document.getElementById("chartsGrid"),
  downloadSampleButton: document.getElementById("downloadSampleButton"),
  downloadReportButton: document.getElementById("downloadReportButton"),
};

document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  updateUploadUi();
});

function wireEvents() {
  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  els.inputs.forEach((input) => {
    input.addEventListener("change", (event) => {
      const slot = Number(event.target.dataset.slot);
      setFile(slot, event.target.files[0] || null);
    });
  });

  els.dropZones.forEach((zone) => {
    zone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        zone.querySelector("input").click();
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        zone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(eventName, () => zone.classList.remove("drag-over"));
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      const slot = Number(zone.dataset.slot);
      const file = event.dataTransfer.files[0] || null;
      setFile(slot, file);
      zone.querySelector("input").value = "";
    });
  });

  els.analyzeButton.addEventListener("click", analyzeSelectedFiles);
  els.clearButton.addEventListener("click", clearFiles);
  els.downloadSampleButton.addEventListener("click", downloadSampleCsv);
  els.downloadReportButton.addEventListener("click", downloadAnalysisReport);
}

function setMode(mode) {
  state.mode = mode;
  els.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  updateUploadUi();
}

function setFile(slot, file) {
  if (file && !file.name.toLowerCase().endsWith(".csv")) {
    showNotice("Please choose a CSV file. The analyzer only accepts files ending in .csv.");
    return;
  }

  state.files[slot] = file;
  hideNotice();
  hideResults();
  updateUploadUi();
}

function clearFiles() {
  state.files = [null, null];
  state.analyses = [];
  els.inputs.forEach((input) => {
    input.value = "";
  });
  hideNotice();
  hideResults();
  els.validation.classList.add("is-hidden");
  updateUploadUi();
}

function updateUploadUi() {
  const isCompare = state.mode === "compare";
  els.secondaryUpload.classList.toggle("is-hidden", !isCompare);

  state.files.forEach((file, index) => {
    const status = document.getElementById(`fileStatus${index}`);
    status.textContent = file ? file.name : "No file selected";
  });

  const requiredCount = isCompare ? 2 : 1;
  const selectedCount = state.files.slice(0, requiredCount).filter(Boolean).length;
  els.analyzeButton.disabled = selectedCount !== requiredCount;
  els.uploadHint.textContent = isCompare
    ? "Select two CSV files to compare sprint profiles."
    : "Select one CSV file to begin.";
}

async function analyzeSelectedFiles() {
  hideNotice();
  hideResults();

  const selectedFiles = state.mode === "compare" ? state.files.slice(0, 2) : state.files.slice(0, 1);
  if (selectedFiles.some((file) => !file)) {
    showNotice(state.mode === "compare" ? "Please add two CSV files first." : "Please add a CSV file first.");
    return;
  }

  const validationResults = [];
  const analyses = [];

  for (const file of selectedFiles) {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const validation = validateSprintData(parsed);

      validationResults.push({
        fileName: file.name,
        valid: validation.valid,
        errors: validation.errors,
        rowCount: validation.rows.length,
      });

      if (validation.valid) {
        analyses.push(analyzeSprint(validation.rows, file.name));
      }
    } catch (error) {
      validationResults.push({
        fileName: file.name,
        valid: false,
        errors: [error.message || "This CSV could not be read."],
        rowCount: 0,
      });
    }
  }

  renderValidation(validationResults);

  if (validationResults.some((result) => !result.valid)) {
    showNotice("One or more files need attention. Fix the listed CSV issue and upload again.");
    return;
  }

  state.analyses = analyses;
  renderResults(analyses);
  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function parseCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  if (!cleanText.trim()) {
    throw new Error("The file is empty.");
  }

  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const next = cleanText[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error("A quoted CSV value is not closed.");
  }

  const nonBlankRows = rows.filter((items) => items.some((item) => item.trim() !== ""));
  if (nonBlankRows.length < 2) {
    throw new Error("The CSV needs a header row and at least 3 data rows.");
  }

  const headers = nonBlankRows[0].map((header) => header.trim());
  const records = nonBlankRows.slice(1).map((items, rowIndex) => {
    const record = {};
    headers.forEach((header, columnIndex) => {
      record[header] = items[columnIndex] === undefined ? "" : items[columnIndex].trim();
    });
    return {
      rowNumber: rowIndex + 2,
      sourceLength: items.length,
      record,
    };
  });

  return { headers, records };
}

function validateSprintData(parsed) {
  const requiredColumns = ["time", "distance"];
  const errors = [];

  requiredColumns.forEach((column) => {
    if (!parsed.headers.includes(column)) {
      errors.push(`Missing required column: ${column}.`);
    }
  });

  if (errors.length) {
    return { valid: false, errors, rows: [] };
  }

  if (parsed.records.length < 3) {
    errors.push("The dataset needs at least 3 rows.");
  }

  const rows = parsed.records.map(({ rowNumber, record, sourceLength }) => {
    const timeRaw = record.time;
    const distanceRaw = record.distance;
    const time = Number(timeRaw);
    const distance = Number(distanceRaw);

    if (sourceLength < parsed.headers.length) {
      errors.push(`Row ${rowNumber} has missing values.`);
    }

    if (timeRaw === "" || distanceRaw === "") {
      errors.push(`Row ${rowNumber} has a missing time or distance value.`);
    } else if (!Number.isFinite(time) || !Number.isFinite(distance)) {
      errors.push(`Row ${rowNumber} contains a non-numeric time or distance value.`);
    }

    return { time, distance };
  });

  rows.forEach((row, index) => {
    if (Number.isFinite(row.time) && row.time < 0) {
      errors.push(`Row ${index + 2} has a negative time value.`);
    }

    if (index > 0 && Number.isFinite(row.time) && Number.isFinite(rows[index - 1].time)) {
      if (row.time < rows[index - 1].time) {
        errors.push("Time values must be increasing.");
      }
    }
  });

  const seenTimes = new Set();
  rows.forEach((row) => {
    if (!Number.isFinite(row.time)) return;
    if (seenTimes.has(row.time)) {
      errors.push("Time values cannot repeat.");
    }
    seenTimes.add(row.time);
  });

  return {
    valid: errors.length === 0,
    errors: unique(errors),
    rows,
  };
}

function analyzeSprint(rows, fileName) {
  const time = rows.map((row) => row.time);
  const distance = rows.map((row) => row.distance);
  const velocity = gradient(distance, time);
  const acceleration = gradient(velocity, time);

  const data = rows.map((row, index) => ({
    ...row,
    velocity: velocity[index],
    acceleration: acceleration[index],
  }));

  const totalTime = time[time.length - 1] - time[0];
  const totalDistance = distance[distance.length - 1] - distance[0];
  const averageVelocity = totalDistance / totalTime;
  const maxVelocity = Math.max(...velocity);
  const peakAcceleration = Math.max(...acceleration);
  const phases = getSprintPhases(data);
  const phaseStats = getPhaseStats(data, phases);

  const label = getDisplayLabel(fileName);
  const graphLabel = getGraphLabel(fileName);
  const percentData = data.map((row) => ({
    ...row,
    percent: ((row.time - time[0]) / totalTime) * 100,
  }));

  return {
    label,
    graphLabel,
    fileName,
    data,
    percentData,
    phases,
    phaseStats,
    summary: {
      totalTime,
      totalDistance,
      averageVelocity,
      maxVelocity,
      peakAcceleration,
    },
  };
}

function gradient(values, coordinates) {
  return values.map((value, index) => {
    if (index === 0) {
      return (values[1] - value) / (coordinates[1] - coordinates[0]);
    }

    if (index === values.length - 1) {
      return (value - values[index - 1]) / (coordinates[index] - coordinates[index - 1]);
    }

    const leftGap = coordinates[index] - coordinates[index - 1];
    const rightGap = coordinates[index + 1] - coordinates[index];
    const numerator =
      leftGap * leftGap * values[index + 1] +
      (rightGap * rightGap - leftGap * leftGap) * value -
      rightGap * rightGap * values[index - 1];
    const denominator = leftGap * rightGap * (leftGap + rightGap);
    return numerator / denominator;
  });
}

function getDisplayLabel(label) {
  const fileName = String(label).trim().split(/[\\/]/).pop().replace(/\.csv$/i, "");
  return fileName || "Sprint";
}

function getGraphLabel(label) {
  const withoutExtension = getDisplayLabel(label);
  let safeLabel = "";

  for (const character of withoutExtension) {
    if (/^[a-z0-9_-]$/i.test(character)) {
      safeLabel += character;
    } else {
      safeLabel += "_";
    }
  }

  while (safeLabel.includes("__")) {
    safeLabel = safeLabel.replaceAll("__", "_");
  }

  safeLabel = safeLabel.replace(/^_+|_+$/g, "");
  return safeLabel || "sprint";
}

function getSprintPhases(data) {
  const startTime = data[0].time;
  const endTime = data[data.length - 1].time;
  const totalTime = endTime - startTime;

  return [
    {
      name: "Start / Drive Phase",
      shortName: "Start",
      className: "phase-start",
      key: "start",
      start: startTime,
      end: startTime + totalTime * 0.2,
    },
    {
      name: "Acceleration Phase",
      shortName: "Accel",
      className: "phase-accel",
      key: "accel",
      start: startTime + totalTime * 0.2,
      end: startTime + totalTime * 0.5,
    },
    {
      name: "Maximum Velocity Phase",
      shortName: "Max V",
      className: "phase-max",
      key: "max",
      start: startTime + totalTime * 0.5,
      end: startTime + totalTime * 0.8,
    },
    {
      name: "Deceleration Phase",
      shortName: "Decel",
      className: "phase-decel",
      key: "decel",
      start: startTime + totalTime * 0.8,
      end: endTime,
    },
  ];
}

function getPercentPhases() {
  return [
    { shortName: "Start", key: "start", start: 0, end: 20 },
    { shortName: "Accel", key: "accel", start: 20, end: 50 },
    { shortName: "Max V", key: "max", start: 50, end: 80 },
    { shortName: "Decel", key: "decel", start: 80, end: 100 },
  ];
}

function getPhaseStats(data, phases) {
  const timeValues = data.map((row) => row.time);
  const distanceValues = data.map((row) => row.distance);
  const velocityValues = data.map((row) => row.velocity);
  const accelerationValues = data.map((row) => row.acceleration);

  return phases.map((phase) => {
    const phaseRows = data.filter((row) => row.time >= phase.start && row.time <= phase.end);
    const startDistance = interpolate(phase.start, timeValues, distanceValues);
    const endDistance = interpolate(phase.end, timeValues, distanceValues);
    const startVelocity = interpolate(phase.start, timeValues, velocityValues);
    const endVelocity = interpolate(phase.end, timeValues, velocityValues);
    const startAcceleration = interpolate(phase.start, timeValues, accelerationValues);
    const endAcceleration = interpolate(phase.end, timeValues, accelerationValues);
    const velocities = phaseRows.map((row) => row.velocity).concat([startVelocity, endVelocity]);
    const accelerations = phaseRows.map((row) => row.acceleration).concat([startAcceleration, endAcceleration]);

    return {
      ...phase,
      averageVelocity: mean(velocities),
      maxVelocity: Math.max(...velocities),
      averageAcceleration: mean(accelerations),
      distanceCovered: endDistance - startDistance,
    };
  });
}

function interpolate(target, xs, ys) {
  if (target <= xs[0]) return ys[0];
  if (target >= xs[xs.length - 1]) return ys[ys.length - 1];

  for (let index = 1; index < xs.length; index += 1) {
    if (target <= xs[index]) {
      const previousX = xs[index - 1];
      const nextX = xs[index];
      const ratio = (target - previousX) / (nextX - previousX);
      return ys[index - 1] + ratio * (ys[index] - ys[index - 1]);
    }
  }

  return ys[ys.length - 1];
}

function renderValidation(results) {
  els.validationGrid.innerHTML = results
    .map((result) => {
      const statusClass = result.valid ? "valid" : "invalid";
      const statusText = result.valid ? "Valid" : "Needs fixes";
      const detail = result.valid
        ? `<p>${result.rowCount} rows checked and ready to analyze.</p>`
        : `<ul>${result.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;

      return `
        <article class="validation-card ${statusClass}">
          <span class="status-pill ${statusClass}">${statusText}</span>
          <h3>${escapeHtml(result.fileName)}</h3>
          ${detail}
        </article>
      `;
    })
    .join("");

  els.validation.classList.remove("is-hidden");
}

function renderResults(analyses) {
  els.resultsIntro.textContent =
    analyses.length === 2
      ? "Compare each sprint individually, then review velocity and acceleration by percent completed."
      : "Review sprint totals, phase metrics, and interactive velocity and acceleration graphs.";

  renderSummary(analyses);
  renderPhaseBreakdown(analyses);
  renderCharts(analyses);
  els.results.classList.remove("is-hidden");
}

function renderSummary(analyses) {
  els.summaryGrid.innerHTML = analyses
    .map((analysis, index) => {
      const metrics = [
        ["Total sprint time", `${formatNumber(analysis.summary.totalTime)} s`],
        ["Total distance", `${formatNumber(analysis.summary.totalDistance)} m`],
        ["Average velocity", `${formatNumber(analysis.summary.averageVelocity)} m/s`],
        ["Maximum velocity", `${formatNumber(analysis.summary.maxVelocity)} m/s`],
        ["Peak acceleration", `${formatNumber(analysis.summary.peakAcceleration)} m/s^2`],
      ];

      return `
        <article class="summary-card">
          <div class="summary-card-header">
            <div>
              <h3>${escapeHtml(analysis.label)}</h3>
              <p>${escapeHtml(analysis.fileName)}</p>
            </div>
            <span class="status-pill valid">Sprint ${index + 1}</span>
          </div>
          <div class="metric-list">
            ${metrics
              .map(
                ([label, value]) => `
                  <div class="metric-row">
                    <span>${label}</span>
                    <strong>${value}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPhaseBreakdown(analyses) {
  els.phaseGrid.innerHTML = analyses
    .map((analysis) => {
      const rows = analysis.phaseStats
        .map(
          (phase) => `
            <tr>
              <td><span class="phase-badge ${phase.className}">${phase.shortName}</span></td>
              <td>${formatNumber(phase.start)} - ${formatNumber(phase.end)} s</td>
              <td>${formatNumber(phase.averageVelocity)} m/s</td>
              <td>${formatNumber(phase.maxVelocity)} m/s</td>
              <td>${formatNumber(phase.averageAcceleration)} m/s^2</td>
              <td>${formatNumber(phase.distanceCovered)} m</td>
            </tr>
          `,
        )
        .join("");

      return `
        <div class="phase-table-wrap">
          <h3>${escapeHtml(analysis.label)}</h3>
          <div class="phase-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Start - End</th>
                  <th>Avg velocity</th>
                  <th>Max velocity</th>
                  <th>Avg acceleration</th>
                  <th>Distance</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderCharts(analyses) {
  destroyCharts();

  const chartCards = [];
  analyses.forEach((analysis, index) => {
    chartCards.push(
      chartCardMarkup(
        `velocity-${index}`,
        `${analysis.label}: Velocity vs. Time`,
        "Individual sprint graph",
        `${analysis.graphLabel}_velocity_vs_time.png`,
      ),
    );
    chartCards.push(
      chartCardMarkup(
        `acceleration-${index}`,
        `${analysis.label}: Acceleration vs. Time`,
        "Individual sprint graph",
        `${analysis.graphLabel}_acceleration_vs_time.png`,
      ),
    );
  });

  if (analyses.length === 2) {
    const comparisonLabel = `${analyses[0].graphLabel}_vs_${analyses[1].graphLabel}`;
    chartCards.push(
      chartCardMarkup(
        "velocity-comparison",
        `${analyses[0].label} vs. ${analyses[1].label}: Velocity Comparison`,
        "Aligned by percent of sprint completed",
        `${comparisonLabel}_velocity_comparison.png`,
      ),
    );
    chartCards.push(
      chartCardMarkup(
        "acceleration-comparison",
        `${analyses[0].label} vs. ${analyses[1].label}: Acceleration Comparison`,
        "Aligned by percent of sprint completed",
        `${comparisonLabel}_acceleration_comparison.png`,
      ),
    );
  }

  els.chartsGrid.innerHTML = chartCards.join("");

  if (!window.Chart) {
    showNotice("Chart.js did not load. Check your internet connection and refresh the page to see interactive graphs.");
    return;
  }

  registerChartPlugin();

  analyses.forEach((analysis, index) => {
    createLineChart({
      canvasId: `velocity-${index}`,
      chartTitle: `${analysis.label}: Velocity vs. Time`,
      downloadFileName: `${analysis.graphLabel}_velocity_vs_time.png`,
      xLabel: "Time (seconds)",
      yLabel: "Velocity (m/s)",
      phases: analysis.phases,
      datasets: [
        datasetConfig(analysis.label, analysis.data.map((row) => ({ x: row.time, y: row.velocity })), index),
      ],
    });

    createLineChart({
      canvasId: `acceleration-${index}`,
      chartTitle: `${analysis.label}: Acceleration vs. Time`,
      downloadFileName: `${analysis.graphLabel}_acceleration_vs_time.png`,
      xLabel: "Time (seconds)",
      yLabel: "Acceleration (m/s^2)",
      phases: analysis.phases,
      datasets: [
        datasetConfig(analysis.label, analysis.data.map((row) => ({ x: row.time, y: row.acceleration })), index),
      ],
    });
  });

  if (analyses.length === 2) {
    const comparisonLabel = `${analyses[0].graphLabel}_vs_${analyses[1].graphLabel}`;

    createLineChart({
      canvasId: "velocity-comparison",
      chartTitle: `${analyses[0].label} vs. ${analyses[1].label}: Velocity Comparison`,
      downloadFileName: `${comparisonLabel}_velocity_comparison.png`,
      xLabel: "Sprint completed (%)",
      yLabel: "Velocity (m/s)",
      phases: getPercentPhases(),
      xMin: 0,
      xMax: 100,
      datasets: analyses.map((analysis, index) =>
        datasetConfig(
          analysis.label,
          analysis.percentData.map((row) => ({ x: row.percent, y: row.velocity })),
          index,
        ),
      ),
    });

    createLineChart({
      canvasId: "acceleration-comparison",
      chartTitle: `${analyses[0].label} vs. ${analyses[1].label}: Acceleration Comparison`,
      downloadFileName: `${comparisonLabel}_acceleration_comparison.png`,
      xLabel: "Sprint completed (%)",
      yLabel: "Acceleration (m/s^2)",
      phases: getPercentPhases(),
      xMin: 0,
      xMax: 100,
      datasets: analyses.map((analysis, index) =>
        datasetConfig(
          analysis.label,
          analysis.percentData.map((row) => ({ x: row.percent, y: row.acceleration })),
          index,
        ),
      ),
    });
  }
}

function chartCardMarkup(canvasId, title, subtitle, downloadFileName) {
  return `
    <article class="chart-card">
      <div class="chart-card-header">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <button
          class="chart-download-button"
          type="button"
          data-chart-download="${canvasId}"
          data-download-name="${escapeHtml(downloadFileName)}"
        >
          Download PNG
        </button>
      </div>
      <div class="chart-frame">
        <canvas id="${canvasId}" aria-label="${escapeHtml(title)}" role="img"></canvas>
      </div>
    </article>
  `;
}

function registerChartPlugin() {
  if (window.phaseShadingRegistered) return;

  Chart.register({
    id: "phaseShading",
    beforeDatasetsDraw(chart) {
      const pluginOptions = chart.options.plugins.phaseShading || {};
      const phases = pluginOptions.phases || [];
      const xScale = chart.scales.x;
      const { ctx, chartArea } = chart;

      if (!xScale || !chartArea || phases.length === 0) return;

      ctx.save();
      phases.forEach((phase) => {
        const start = Math.max(chartArea.left, xScale.getPixelForValue(phase.start));
        const end = Math.min(chartArea.right, xScale.getPixelForValue(phase.end));
        ctx.fillStyle = phaseColors[phase.key] || "rgba(4, 154, 154, 0.08)";
        ctx.fillRect(start, chartArea.top, Math.max(end - start, 0), chartArea.bottom - chartArea.top);
      });
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const pluginOptions = chart.options.plugins.phaseShading || {};
      const phases = pluginOptions.phases || [];
      const xScale = chart.scales.x;
      const { ctx, chartArea } = chart;

      if (!xScale || !chartArea || phases.length === 0) return;

      ctx.save();
      ctx.font = "700 11px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(22, 32, 35, 0.72)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      phases.forEach((phase) => {
        const middle = xScale.getPixelForValue((phase.start + phase.end) / 2);
        if (middle >= chartArea.left && middle <= chartArea.right) {
          ctx.fillText(phase.shortName, middle, chartArea.top + 8);
        }
      });
      ctx.restore();
    },
  });

  window.phaseShadingRegistered = true;
}

function createLineChart({ canvasId, chartTitle, downloadFileName, xLabel, yLabel, phases, datasets, xMin, xMax }) {
  const canvas = document.getElementById(canvasId);
  const chart = new Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "nearest",
      },
      plugins: {
        title: {
          display: true,
          text: chartTitle,
          color: "#162023",
          font: { size: 15, weight: "800" },
          padding: { bottom: 12 },
        },
        legend: {
          display: true,
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatNumber(context.parsed.y)}${yLabel.includes("Acceleration") ? " m/s^2" : " m/s"}`;
            },
          },
        },
        phaseShading: { phases },
      },
      scales: {
        x: {
          type: "linear",
          min: xMin,
          max: xMax,
          title: {
            display: true,
            text: xLabel,
            color: "#465a60",
            font: { weight: "700" },
          },
          grid: { color: "rgba(100, 114, 119, 0.16)" },
          ticks: { color: "#647277" },
        },
        y: {
          title: {
            display: true,
            text: yLabel,
            color: "#465a60",
            font: { weight: "700" },
          },
          grid: { color: "rgba(100, 114, 119, 0.16)" },
          ticks: { color: "#647277" },
        },
      },
    },
  });

  state.charts.push(chart);

  const downloadButton = document.querySelector(`[data-chart-download="${canvasId}"]`);
  if (downloadButton) {
    downloadButton.addEventListener("click", () => downloadChart(chart, downloadFileName));
  }
}

function datasetConfig(label, points, index) {
  return {
    label,
    data: points,
    borderColor: dataColors[index % dataColors.length],
    backgroundColor: dataFills[index % dataFills.length],
    borderWidth: 3,
    pointRadius: 3,
    pointHoverRadius: 6,
    pointBackgroundColor: "#ffffff",
    pointBorderWidth: 2,
    tension: 0.28,
    fill: true,
  };
}

function destroyCharts() {
  state.charts.forEach((chart) => chart.destroy());
  state.charts = [];
}

function hideResults() {
  destroyCharts();
  els.results.classList.add("is-hidden");
  els.summaryGrid.innerHTML = "";
  els.phaseGrid.innerHTML = "";
  els.chartsGrid.innerHTML = "";
}

function showNotice(message) {
  els.notice.textContent = message;
  els.notice.classList.remove("is-hidden");
}

function hideNotice() {
  els.notice.classList.add("is-hidden");
  els.notice.textContent = "";
}

function downloadChart(chart, filename) {
  const link = document.createElement("a");
  link.href = chart.toBase64Image("image/png", 1);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadAnalysisReport() {
  if (state.analyses.length === 0) {
    showNotice("Analyze a CSV file first, then download the complete analysis.");
    return;
  }

  const report = {
    exportedAt: new Date().toISOString(),
    mode: state.analyses.length === 2 ? "compare" : "single",
    sprintCount: state.analyses.length,
    sprints: state.analyses.map((analysis) => ({
      label: analysis.label,
      fileName: analysis.fileName,
      summary: {
        totalSprintTimeSeconds: roundForExport(analysis.summary.totalTime),
        totalDistanceMeters: roundForExport(analysis.summary.totalDistance),
        averageVelocityMetersPerSecond: roundForExport(analysis.summary.averageVelocity),
        maximumVelocityMetersPerSecond: roundForExport(analysis.summary.maxVelocity),
        peakAccelerationMetersPerSecondSquared: roundForExport(analysis.summary.peakAcceleration),
      },
      phases: analysis.phaseStats.map((phase) => ({
        name: phase.name,
        shortName: phase.shortName,
        startTimeSeconds: roundForExport(phase.start),
        endTimeSeconds: roundForExport(phase.end),
        averageVelocityMetersPerSecond: roundForExport(phase.averageVelocity),
        maximumVelocityMetersPerSecond: roundForExport(phase.maxVelocity),
        averageAccelerationMetersPerSecondSquared: roundForExport(phase.averageAcceleration),
        distanceCoveredMeters: roundForExport(phase.distanceCovered),
      })),
      rows: analysis.percentData.map((row) => ({
        timeSeconds: roundForExport(row.time),
        distanceMeters: roundForExport(row.distance),
        velocityMetersPerSecond: roundForExport(row.velocity),
        accelerationMetersPerSecondSquared: roundForExport(row.acceleration),
        sprintCompletedPercent: roundForExport(row.percent),
      })),
      graphFiles: {
        velocityVsTime: `${analysis.graphLabel}_velocity_vs_time.png`,
        accelerationVsTime: `${analysis.graphLabel}_acceleration_vs_time.png`,
      },
    })),
  };

  if (state.analyses.length === 2) {
    const comparisonLabel = `${state.analyses[0].graphLabel}_vs_${state.analyses[1].graphLabel}`;
    report.comparison = {
      labels: state.analyses.map((analysis) => analysis.label),
      graphFiles: {
        velocityComparison: `${comparisonLabel}_velocity_comparison.png`,
        accelerationComparison: `${comparisonLabel}_acceleration_comparison.png`,
      },
      note: "Comparison chart rows are included in each sprint's rows using sprintCompletedPercent.",
    };
  }

  const reportFileName =
    state.analyses.length === 2
      ? `${state.analyses[0].graphLabel}_vs_${state.analyses[1].graphLabel}_complete_analysis.json`
      : `${state.analyses[0].graphLabel}_complete_analysis.json`;

  downloadJson(report, reportFileName);
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSampleCsv() {
  const csv = [
    "time,distance",
    "0,0",
    "0.5,2.1",
    "1.0,5.8",
    "1.5,10.9",
    "2.0,17.4",
    "2.5,24.1",
    "3.0,30.2",
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sample-sprint-data.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function roundForExport(value) {
  return Number(Number(value).toFixed(6));
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function unique(values) {
  return [...new Set(values)];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
