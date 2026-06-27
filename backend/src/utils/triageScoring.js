const calculateGCS = (eyes, verbal, motor) => {
  if (eyes == null || verbal == null || motor == null) return null;
  return eyes + verbal + motor;
};

const calculateMEWS = (vitals) => {
  let score = 0;
  const { heartRate, respirationRate, temperature, bloodPressureSystolic, gcsTotal } = vitals;

  if (heartRate != null) {
    if (heartRate <= 40) score += 2;
    else if (heartRate <= 50) score += 1;
    else if (heartRate <= 100) score += 0;
    else if (heartRate <= 110) score += 1;
    else if (heartRate <= 129) score += 2;
    else score += 3;
  }

  if (respirationRate != null) {
    if (respirationRate <= 8) score += 2;
    else if (respirationRate <= 14) score += 0;
    else if (respirationRate <= 20) score += 1;
    else if (respirationRate <= 29) score += 2;
    else score += 3;
  }

  if (temperature != null) {
    if (temperature < 35) score += 2;
    else if (temperature <= 38.4) score += 0;
    else score += 1;
  }

  if (bloodPressureSystolic != null) {
    if (bloodPressureSystolic <= 70) score += 3;
    else if (bloodPressureSystolic <= 80) score += 2;
    else if (bloodPressureSystolic <= 100) score += 1;
    else if (bloodPressureSystolic <= 199) score += 0;
    else score += 2;
  }

  if (gcsTotal != null) {
    if (gcsTotal < 9) score += 3;
    else if (gcsTotal <= 12) score += 2;
    else if (gcsTotal <= 14) score += 1;
    else score += 0;
  }

  return score;
};

const calculateQSOFA = (vitals) => {
  let score = 0;
  const { respirationRate, bloodPressureSystolic, gcsTotal } = vitals;

  if (respirationRate != null && respirationRate >= 22) score += 1;
  if (bloodPressureSystolic != null && bloodPressureSystolic <= 100) score += 1;
  if (gcsTotal != null && gcsTotal < 15) score += 1;

  return score;
};

const getMEWSRisk = (score) => {
  if (score == null) return { level: 'unknown', color: 'gray' };
  if (score >= 5) return { level: 'HIGH', color: 'red' };
  if (score >= 3) return { level: 'MEDIUM', color: 'orange' };
  return { level: 'LOW', color: 'green' };
};

module.exports = {
  calculateGCS,
  calculateMEWS,
  calculateQSOFA,
  getMEWSRisk
};
