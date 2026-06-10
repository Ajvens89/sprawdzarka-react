import { useState } from "react";

export function StepGuide({
  steps
}: {
  steps: Array<{
    title: string;
    description: string;
    help?: string;
    action?: JSX.Element;
  }>;
}): JSX.Element {
  const [openHelp, setOpenHelp] = useState<number | null>(null);

  return (
    <ol className="step-guide">
      {steps.map((step, index) => (
        <li key={step.title} className="step-guide__item">
          <span className="step-guide__num">{index + 1}</span>
          <div className="step-guide__body">
            <strong>{step.title}</strong>
            <p>{step.description}</p>
            {step.help ? (
              <div className="step-guide__help">
                <button
                  className="step-guide__help-toggle"
                  type="button"
                  aria-expanded={openHelp === index}
                  onClick={() => setOpenHelp((current) => (current === index ? null : index))}
                >
                  Więcej informacji
                </button>
                {openHelp === index ? <p className="step-guide__help-text">{step.help}</p> : null}
              </div>
            ) : null}
            {step.action ? <div className="step-guide__action">{step.action}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
