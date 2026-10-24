import { mkdir, writeFile } from 'node:fs/promises';
import { workflows, automationTemplate, intelAutomationTemplate } from '../src/lib/content';
import { simulate } from '../src/lib/engine';
import { defaultParameters } from '../src/lib/model';
await mkdir('fixtures', { recursive: true });
for (const w of [...Object.values(workflows), automationTemplate, intelAutomationTemplate])
  await writeFile(
    `fixtures/${w.id}.json`,
    JSON.stringify(
      {
        notice: 'Synthetic educational fixture. Not live telemetry.',
        workflow: w,
        parameters: defaultParameters,
        events: simulate(w, defaultParameters),
      },
      null,
      2,
    ),
  );
console.log('Wrote six deterministic educational fixtures.');
