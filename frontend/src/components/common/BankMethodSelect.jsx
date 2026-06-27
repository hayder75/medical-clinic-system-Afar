import React from 'react';
import { ETHIOPIAN_BANK_METHOD_OPTIONS } from '../../constants/bankOptions';

const BankMethodSelect = ({ value, onChange, className = '', allowEmpty = true, ...rest }) => {
  return (
    <select value={value || ''} onChange={onChange} className={className} {...rest}>
      {allowEmpty && <option value="">Select bank or wallet</option>}
      {ETHIOPIAN_BANK_METHOD_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
};

export default BankMethodSelect;
