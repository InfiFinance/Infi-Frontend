import React from 'react';

interface StepperProps {
  steps: string[];
  currentStep: number; // 1-based index
}

const Stepper: React.FC<StepperProps> = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-center w-full py-4">
      {steps.map((label, idx) => (
        <React.Fragment key={label}>
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors font-semibold text-base
              ${currentStep === idx + 1
                ? 'bg-[#232b38] text-blue-400 border border-blue-500'
                : 'bg-[#181c23] text-gray-400 border border-[#232b38]'}
            `}
          >
            {idx + 1}
          </div>
          {idx < steps.length - 1 && (
            <div className="w-8 h-0.5 mx-2 bg-[#232b38]" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Stepper; 