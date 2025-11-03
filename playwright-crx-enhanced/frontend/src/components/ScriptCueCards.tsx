import React from 'react';
import './ScriptCueCards.css';

type ScriptMinimal = {
  id: string;
  name: string;
  language?: string;
};

interface Props {
  script: ScriptMinimal;
  onGenerate?: (script: ScriptMinimal) => void;
  onEnhance?: (script: ScriptMinimal) => void;
  onValidate?: (script: ScriptMinimal) => void;
  onFinalize?: (script: ScriptMinimal) => void;
  onInsights?: (script: ScriptMinimal) => void;
}

const ScriptCueCards: React.FC<Props> = ({ script, onGenerate, onEnhance, onValidate, onFinalize, onInsights }) => {
  const fallback = (label: string) => () => alert(`${label} is coming soon for: ${script.name}`);

  return (
    <div className="cue-steps">
      <div className="cue-steps-header">
        <div>
          <span className="cue-steps-title">New Script Workflow</span>
          <span className="cue-steps-subtitle">Guided 5-step process</span>
        </div>
        <span className="cue-steps-badge">5 Steps</span>
      </div>

      <div className="cue-progress" aria-hidden="true">
        <span className="cue-dot generate" />
        <span className="cue-line" />
        <span className="cue-dot enhance" />
        <span className="cue-line" />
        <span className="cue-dot validate" />
        <span className="cue-line" />
        <span className="cue-dot finalize" />
        <span className="cue-line" />
        <span className="cue-dot insights" />
      </div>

      <div className="cue-steps-grid">
        <div className="cue-step-card generate">
          <div className="cue-step-card-header">
            <div className="cue-step-icon">1</div>
            <div className="cue-step-headings">
              <div className="step-title">Generate</div>
              <div className="step-desc">Create or scaffold initial script steps.</div>
            </div>
          </div>
          <div className="cue-step-card-content">
            <p>Use curated templates or import a sample to bootstrap a new script.</p>
          </div>
          <div className="cue-step-card-actions">
            <button
              className="btn-primary step-action"
              onClick={() => (onGenerate ? onGenerate(script) : fallback('Generate')())}
            >
              Import Sample Script
            </button>
          </div>
        </div>

        <div className="cue-step-card enhance">
          <div className="cue-step-card-header">
            <div className="cue-step-icon">2</div>
            <div className="cue-step-headings">
              <div className="step-title">Enhance with AI</div>
              <div className="step-desc">Improve locators and flows using AI.</div>
            </div>
          </div>
          <div className="cue-step-card-content">
            <p>AI suggests stronger selectors, waits, and resiliency improvements.</p>
          </div>
          <div className="cue-step-card-actions">
            <button
              className="btn-secondary step-action"
              onClick={() => (onEnhance ? onEnhance(script) : fallback('Enhance with AI')())}
            >
              Open AI Enhancement
            </button>
          </div>
        </div>

        <div className="cue-step-card validate">
          <div className="cue-step-card-header">
            <div className="cue-step-icon">3</div>
            <div className="cue-step-headings">
              <div className="step-title">Human Validation</div>
              <div className="step-desc">Review logic and verify selectors.</div>
            </div>
          </div>
          <div className="cue-step-card-content">
            <p>Review diffs and confirm changes step-by-step to maintain control.</p>
          </div>
          <div className="cue-step-card-actions">
            <button
              className="btn-secondary step-action"
              onClick={() => (onValidate ? onValidate(script) : fallback('Human Validation')())}
            >
              Start Validation Review
            </button>
          </div>
        </div>

        <div className="cue-step-card finalize">
          <div className="cue-step-card-header">
            <div className="cue-step-icon">4</div>
            <div className="cue-step-headings">
              <div className="step-title">Finalize / Run</div>
              <div className="step-desc">Save, run, and monitor execution in real-time.</div>
            </div>
          </div>
          <div className="cue-step-card-content">
            <p>Lock changes and execute. Monitor logs, screenshots, and metrics.</p>
          </div>
          <div className="cue-step-card-actions">
            <button
              className="btn-primary step-action"
              onClick={() => (onFinalize ? onFinalize(script) : fallback('Finalize / Run')())}
            >
              Finalize and Execute
            </button>
          </div>
        </div>

        <div className="cue-step-card insights">
          <div className="cue-step-card-header">
            <div className="cue-step-icon">5</div>
            <div className="cue-step-headings">
              <div className="step-title">AI Insights</div>
              <div className="step-desc">View reliability trends, flaky steps, and healing tips.</div>
            </div>
          </div>
          <div className="cue-step-card-content">
            <p>Explore AI insights: top failures, suggested fixes, and stability trends.</p>
          </div>
          <div className="cue-step-card-actions">
            <button
              className="btn-secondary step-action"
              onClick={() => (onInsights ? onInsights(script) : fallback('AI Insights')())}
            >
              Open Insights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptCueCards;