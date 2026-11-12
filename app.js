const POPULATION = 10000;

const DEFAULTS = {
  initialInfected: 1,
  infectiousPeriod: 10,
  immunityDuration: 90,
  contactRate: 5,
  infectionProbability: 0.1,
  simulationLength: 1080
};

const CONTROLS = [
  {
    key: "initialInfected",
    rangeId: "initialInfectedRange",
    numberId: "initialInfectedNumber",
    min: 1,
    max: 1000,
    step: 1
  },
  {
    key: "infectiousPeriod",
    rangeId: "infectiousPeriodRange",
    numberId: "infectiousPeriodNumber",
    min: 1,
    max: 60,
    step: 1
  },
  {
    key: "immunityDuration",
    rangeId: "immunityDurationRange",
    numberId: "immunityDurationNumber",
    min: 1,
    max: 1080,
    step: 1
  },
  {
    key: "contactRate",
    rangeId: "contactRateRange",
    numberId: "contactRateNumber",
    min: 0,
    max: 30,
    step: 0.1
  },
  {
    key: "infectionProbability",
    rangeId: "infectionProbabilityRange",
    numberId: "infectionProbabilityNumber",
    min: 0,
    max: 1,
    step: 0.01
  },
  {
    key: "simulationLength",
    rangeId: "simulationLengthRange",
    numberId: "simulationLengthNumber",
    min: 30,
    max: 3650,
    step: 1
  }
];

const COLORS = {
  susceptible: "#2563eb",
  infected: "#dc2626",
  recovered: "#16a34a",
  axis: "#334155",
  grid: "#e2e8f0",
  label: "#64748b"
};

const form = document.getElementById("controls-form");
const resetButton = document.getElementById("resetButton");
const r0Value = document.getElementById("r0Value");
const canvas = document.getElementById("sirsChart");
const ctx = canvas.getContext("2d");
let lastSimulationData = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundToStep(value, step) {
  const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

function formatInputValue(value, step) {
  if (Number.isInteger(step)) {
    return String(Math.round(value));
  }

  const decimals = String(step).split(".")[1].length;
  return Number(value).toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function normalizeValue(value, control) {
  const parsed = Number(value);
  const fallback = DEFAULTS[control.key];
  const numeric = Number.isFinite(parsed) ? parsed : fallback;
  return roundToStep(clamp(numeric, control.min, control.max), control.step);
}

function setControlValue(control, value) {
  const normalized = normalizeValue(value, control);
  const displayValue = formatInputValue(normalized, control.step);
  document.getElementById(control.rangeId).value = displayValue;
  document.getElementById(control.numberId).value = displayValue;
}

function setupLinkedInputs() {
  CONTROLS.forEach((control) => {
    const range = document.getElementById(control.rangeId);
    const number = document.getElementById(control.numberId);

    range.addEventListener("input", () => {
      number.value = range.value;
    });

    number.addEventListener("input", () => {
      if (number.value === "") {
        return;
      }

      const parsed = Number(number.value);
      if (Number.isFinite(parsed)) {
        const rangeValue = normalizeValue(parsed, control);
        range.value = formatInputValue(rangeValue, control.step);
      }
    });

    number.addEventListener("blur", () => {
      setControlValue(control, number.value);
    });
  });
}

function getParameters() {
  return CONTROLS.reduce((params, control) => {
    const value = document.getElementById(control.numberId).value;
    const normalized = normalizeValue(value, control);
    setControlValue(control, normalized);
    params[control.key] = normalized;
    return params;
  }, {});
}

function resetDefaults() {
  CONTROLS.forEach((control) => {
    setControlValue(control, DEFAULTS[control.key]);
  });
  runAndDrawSimulation();
}

function runSirsModel(params) {
  const beta = params.contactRate * params.infectionProbability;
  const gamma = 1 / params.infectiousPeriod;
  const omega = 1 / params.immunityDuration;

  let susceptible = POPULATION - params.initialInfected;
  let infected = params.initialInfected;
  let recovered = 0;

  const data = {
    days: [],
    susceptible: [],
    infected: [],
    recovered: []
  };

  for (let day = 0; day <= params.simulationLength; day += 1) {
    data.days.push(day);
    data.susceptible.push(susceptible);
    data.infected.push(infected);
    data.recovered.push(recovered);

    if (day === params.simulationLength) {
      break;
    }

    const newInfections = Math.min(susceptible, beta * susceptible * infected / POPULATION);
    const newRecoveries = Math.min(infected, gamma * infected);
    const newWaning = Math.min(recovered, omega * recovered);

    susceptible = susceptible - newInfections + newWaning;
    infected = infected + newInfections - newRecoveries;
    recovered = recovered + newRecoveries - newWaning;

    const total = susceptible + infected + recovered;
    const correction = POPULATION - total;
    susceptible += correction;

    susceptible = Math.max(0, susceptible);
    infected = Math.max(0, infected);
    recovered = Math.max(0, recovered);
  }

  return {
    beta,
    gamma,
    omega,
    r0: beta / gamma,
    data
  };
}

function resizeCanvasForDisplay() {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(320, Math.floor(rect.height));

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  return { width, height };
}

function drawLine(points, xScale, yScale, color) {
  ctx.beginPath();
  points.forEach((value, index) => {
    const x = xScale(index);
    const y = yScale(value);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawChart(data) {
  const { width, height } = resizeCanvasForDisplay();
  const margin = {
    top: 24,
    right: 24,
    bottom: 52,
    left: 72
  };

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxDay = data.days[data.days.length - 1];

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const xScale = (dayIndex) => {
    const day = data.days[dayIndex];
    if (maxDay === 0) {
      return margin.left;
    }
    return margin.left + (day / maxDay) * plotWidth;
  };

  const yScale = (population) => {
    return margin.top + plotHeight - (population / POPULATION) * plotHeight;
  };

  drawGridAndAxes({ width, height, margin, plotWidth, plotHeight, maxDay, yScale });

  drawLine(data.susceptible, xScale, yScale, COLORS.susceptible);
  drawLine(data.infected, xScale, yScale, COLORS.infected);
  drawLine(data.recovered, xScale, yScale, COLORS.recovered);
}

function drawGridAndAxes({ width, height, margin, plotWidth, plotHeight, maxDay, yScale }) {
  ctx.save();
  ctx.font = "12px Arial, Helvetica, sans-serif";
  ctx.textBaseline = "middle";

  const yTicks = [0, 2500, 5000, 7500, 10000];
  yTicks.forEach((tick) => {
    const y = yScale(tick);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + plotWidth, y);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLORS.label;
    ctx.textAlign = "right";
    ctx.fillText(tick.toLocaleString(), margin.left - 10, y);
  });

  const xTickCount = 6;
  for (let i = 0; i <= xTickCount; i += 1) {
    const day = Math.round((maxDay / xTickCount) * i);
    const x = margin.left + (day / maxDay) * plotWidth;

    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotHeight);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLORS.label;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(day.toLocaleString(), x, margin.top + plotHeight + 12);
  }

  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotHeight);
  ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = COLORS.axis;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Days", margin.left + plotWidth / 2, height - 12);

  ctx.save();
  ctx.translate(18, margin.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Population", 0, 0);
  ctx.restore();

  ctx.restore();
}

function runAndDrawSimulation() {
  const params = getParameters();
  const result = runSirsModel(params);
  r0Value.textContent = result.r0.toFixed(2);
  lastSimulationData = result.data;
  drawChart(lastSimulationData);
}

function redrawLastSimulation() {
  if (lastSimulationData) {
    drawChart(lastSimulationData);
  }
}

setupLinkedInputs();
form.addEventListener("submit", (event) => {
  event.preventDefault();
  runAndDrawSimulation();
});
resetButton.addEventListener("click", resetDefaults);
window.addEventListener("resize", redrawLastSimulation);

runAndDrawSimulation();
