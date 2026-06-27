import React from 'react';

const getMEWSInfo = (score) => {
  if (score == null || score === undefined) return { color: 'bg-gray-100 text-gray-600', label: 'N/A' };
  if (score >= 5) return { color: 'bg-red-100 text-red-800 border-red-300', label: `MEWS: ${score} HIGH` };
  if (score >= 3) return { color: 'bg-orange-100 text-orange-800 border-orange-300', label: `MEWS: ${score} MED` };
  return { color: 'bg-green-100 text-green-800 border-green-300', label: `MEWS: ${score} LOW` };
};

const getQSOFAInfo = (score) => {
  if (score == null || score === undefined) return { color: 'bg-gray-100 text-gray-600', label: 'qSOFA: -' };
  if (score >= 2) return { color: 'bg-red-100 text-red-800 border-red-300', label: `qSOFA: ${score} HIGH` };
  return { color: 'bg-green-100 text-green-800 border-green-300', label: `qSOFA: ${score}` };
};

const TriageScoreBadge = ({ vitals, showLabel = true, size = 'sm' }) => {
  if (!vitals) return null;
  const { gcsTotal, mewsScore, qsofaScore } = vitals;
  const mews = getMEWSInfo(mewsScore);
  const qsofa = getQSOFAInfo(qsofaScore);
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex gap-1.5 items-center">
      {gcsTotal != null && (
        <span className={`inline-block px-1.5 py-0.5 rounded border ${textSize} font-medium bg-purple-100 text-purple-800 border-purple-300`}>
          GCS: {gcsTotal}
        </span>
      )}
      <span className={`inline-block px-1.5 py-0.5 rounded border ${textSize} font-medium ${mews.color}`}>
        {mews.label}
      </span>
      <span className={`inline-block px-1.5 py-0.5 rounded border ${textSize} font-medium ${qsofa.color}`}>
        {qsofa.label}
      </span>
    </div>
  );
};

export { getMEWSInfo, getQSOFAInfo };
export default TriageScoreBadge;
