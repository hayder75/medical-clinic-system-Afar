export function calculateAge(dob) {
  if (!dob) return '';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return '';
  const today = new Date();

  let years = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) years--;

  if (years < 0) return '';

  if (years === 0) {
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    if (days < 0) {
      months--;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) months = 0;
    if (months === 0) {
      return `${days}d`;
    }
    return `${months}m ${days}d`;
  }

  return years;
}

export function formatAge(age, dob) {
  if (age !== undefined && age !== null && String(age).trim() !== '' && String(age) !== '0') {
    return String(age).trim();
  }
  return calculateAge(dob);
}
