
import React from 'react';
import { Box, Text } from 'ink';

export default function ProgressTUI({ steps, currentStep, status }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', margin: 1 },
    steps.map((step, idx) =>
      React.createElement(
        Box,
        { key: step },
        [
          React.createElement(
            Text,
            { key: 'text', color: idx < currentStep ? 'green' : idx === currentStep ? 'yellow' : 'gray' },
            `${idx < currentStep ? '✔' : idx === currentStep ? '➔' : '•'} ${step}`
          ),
          idx === currentStep && status
            ? React.createElement(
                Text,
                { key: 'status', color: 'cyan' },
                `  ${status}`
              )
            : null
        ]
      )
    )
  );
}
