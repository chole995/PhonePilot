/**
 * MCP Tool: execute-sequence
 * Executes a predefined auto operation sequence.
 */

import { z } from 'zod';
import {
  getArmState,
  updateArmState,
  buildArmApiUrl,
  captureFrame,
  delay,
  ARM_CONFIG,
  shouldStopSequenceExecution,
  setStopSequenceFlag,
} from '../state';
import { getSequence, getFullSteps, getAllSequenceIds } from '../sequences';

import type { AutoStep } from '../sequences';

/** Input schema for execute-sequence tool */
export const executeSequenceSchema = z.object({
  sequenceId: z
    .string()
    .describe(`The ID of the sequence to execute. Available: ${getAllSequenceIds().join(', ')}`),
  returnFrame: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to capture and return a frame after completion (default: true)'),
});

export type ExecuteSequenceInput = z.infer<typeof executeSequenceSchema>;

/** Output type for execute-sequence tool */
export interface ExecuteSequenceOutput {
  success: boolean;
  message: string;
  sequenceId?: string;
  sequenceName?: string;
  stepsCompleted?: number;
  totalSteps?: number;
}

/**
 * Executes a single step (click or swipe).
 */
async function executeStep(
  step: AutoStep,
  resourceHandle: number,
  httpRequest: (url: string) => Promise<string>
): Promise<void> {
  if (step.swipeTo) {
    // Swipe operation: move to start -> lower stylus -> move to end -> raise stylus
    const moveToStartUrl = buildArmApiUrl({
      duankou: '0',
      hco: resourceHandle,
      daima: `X${step.x}Y${step.y}`,
    });
    await httpRequest(moveToStartUrl);

    const lowerUrl = buildArmApiUrl({
      duankou: '0',
      hco: resourceHandle,
      daima: `Z${step.depth}`,
    });
    await httpRequest(lowerUrl);

    await delay(50);

    const swipeUrl = buildArmApiUrl({
      duankou: '0',
      hco: resourceHandle,
      daima: `X${step.swipeTo.x}Y${step.swipeTo.y}`,
    });
    await httpRequest(swipeUrl);

    // Wait before raising stylus
    await delay(step.swipeHoldDelay ?? 50);

    const raiseUrl = buildArmApiUrl({
      duankou: '0',
      hco: resourceHandle,
      daima: `Z${ARM_CONFIG.zUp}`,
    });
    await httpRequest(raiseUrl);

    // Update position
    updateArmState({
      currentX: step.swipeTo.x,
      currentY: step.swipeTo.y,
    });
  } else {
    // Click operation: move to position -> lower stylus -> raise stylus
    const moveUrl = buildArmApiUrl({
      duankou: '0',
      hco: resourceHandle,
      daima: `X${step.x}Y${step.y}`,
    });
    await httpRequest(moveUrl);

    const lowerUrl = buildArmApiUrl({
      duankou: '0',
      hco: resourceHandle,
      daima: `Z${step.depth}`,
    });
    await httpRequest(lowerUrl);

    await delay(ARM_CONFIG.clickDelay);

    const raiseUrl = buildArmApiUrl({
      duankou: '0',
      hco: resourceHandle,
      daima: `Z${ARM_CONFIG.zUp}`,
    });
    await httpRequest(raiseUrl);

    // Update position
    updateArmState({
      currentX: step.x,
      currentY: step.y,
    });
  }

  // Wait after step
  await delay(step.delayAfter ?? 200);
}

/**
 * Executes the execute-sequence tool.
 * Runs all steps in the specified sequence.
 */
export async function executeExecuteSequence(
  input: ExecuteSequenceInput,
  httpRequest: (url: string) => Promise<string>
): Promise<{ output: ExecuteSequenceOutput; frame: string | null }> {
  const state = getArmState();

  if (!state.isConnected || state.resourceHandle <= 0) {
    return {
      output: {
        success: false,
        message: 'Not connected to arm controller. Call arm-connect first.',
      },
      frame: null,
    };
  }

  const sequence = getSequence(input.sequenceId);
  if (!sequence) {
    return {
      output: {
        success: false,
        message: `Unknown sequence ID: ${input.sequenceId}. Available: ${getAllSequenceIds().join(', ')}`,
      },
      frame: null,
    };
  }

  const steps = getFullSteps(sequence);
  let stepsCompleted = 0;

  // Reset stop flag at start
  setStopSequenceFlag(false);

  try {
    for (const step of steps) {
      // Check stop flag before each step
      if (shouldStopSequenceExecution()) {
        return {
          output: {
            success: false,
            message: `Sequence "${sequence.name}" stopped by user at step ${stepsCompleted + 1}`,
            sequenceId: sequence.id,
            sequenceName: sequence.name,
            stepsCompleted,
            totalSteps: steps.length,
          },
          frame: null,
        };
      }

      await executeStep(step, state.resourceHandle, httpRequest);
      stepsCompleted++;
      console.log(`[execute-sequence] Step ${stepsCompleted}/${steps.length}: ${step.label}`);
    }

    // Capture frame if requested
    let frame: string | null = null;
    if (input.returnFrame !== false) {
      frame = await captureFrame();
    }

    return {
      output: {
        success: true,
        message: `Sequence "${sequence.name}" completed successfully`,
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        stepsCompleted,
        totalSteps: steps.length,
      },
      frame,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      output: {
        success: false,
        message: `Sequence execution failed at step ${stepsCompleted + 1}: ${errorMessage}`,
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        stepsCompleted,
        totalSteps: steps.length,
      },
      frame: null,
    };
  }
}
