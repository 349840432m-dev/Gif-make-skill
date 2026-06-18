import { describe, expect, it } from 'vitest'
import {
  calculateSlideshowDuration,
  calculateTransitionVisuals,
  DEFAULT_HOLD_DURATION,
  DEFAULT_TRANSITION_DURATION,
  getSlideshowStateAtProgress,
  getSlideshowStateAtTime,
  normalizeSlideshowTiming,
  type TransitionId,
} from './slideshow'

describe('slideshow timing', () => {
  it('uses the default hold duration for 2-10 images', () => {
    expect(calculateSlideshowDuration(2)).toBe(3)
    expect(calculateSlideshowDuration(10)).toBe(15)
    expect(DEFAULT_HOLD_DURATION).toBe(1.5)
    expect(DEFAULT_TRANSITION_DURATION).toBe(0.4)
  })

  it('rejects image counts outside the supported integer range', () => {
    expect(() => calculateSlideshowDuration(1)).toThrow(RangeError)
    expect(() => calculateSlideshowDuration(11)).toThrow(RangeError)
    expect(() => calculateSlideshowDuration(2.5)).toThrow(RangeError)
  })

  it('rejects invalid durations and limits transition duration to hold duration', () => {
    expect(() => normalizeSlideshowTiming({ holdDuration: 0 })).toThrow(RangeError)
    expect(() => normalizeSlideshowTiming({ transitionDuration: -1 })).toThrow(RangeError)
    expect(() => normalizeSlideshowTiming({ holdDuration: Number.NaN })).toThrow(RangeError)
    expect(normalizeSlideshowTiming({ holdDuration: 1, transitionDuration: 2 })).toEqual({
      holdDuration: 1,
      transitionDuration: 1,
    })
  })
})

describe('getSlideshowStateAtTime', () => {
  it('returns the current and next image within a hold segment', () => {
    expect(getSlideshowStateAtTime(3, 1.5)).toEqual({
      currentIndex: 1,
      nextIndex: 2,
      localProgress: 0,
      transitionProgress: 0,
    })
  })

  it('starts the transition at the end of each hold segment', () => {
    const state = getSlideshowStateAtTime(3, 1.3)

    expect(state.currentIndex).toBe(0)
    expect(state.nextIndex).toBe(1)
    expect(state.localProgress).toBeCloseTo(1.3 / 1.5)
    expect(state.transitionProgress).toBeCloseTo(0.5)
  })

  it('loops continuously from the final image to the first', () => {
    const finalTransition = getSlideshowStateAtTime(3, 4.3)

    expect(finalTransition.currentIndex).toBe(2)
    expect(finalTransition.nextIndex).toBe(0)
    expect(finalTransition.transitionProgress).toBeCloseTo(0.5)
    expect(getSlideshowStateAtTime(3, 4.5)).toEqual(
      getSlideshowStateAtTime(3, 0),
    )
  })

  it('does not transition from the final image to the first when loop is disabled', () => {
    expect(getSlideshowStateAtTime(3, 99, { loop: false })).toMatchObject({
      currentIndex: 2,
      nextIndex: 2,
      transitionProgress: 0,
    })
    expect(getSlideshowStateAtProgress(3, 1, { loop: false })).toMatchObject({
      currentIndex: 2,
      nextIndex: 2,
      transitionProgress: 0,
    })
  })

  it('wraps negative time and converges non-finite time to the first frame', () => {
    const wrapped = getSlideshowStateAtTime(2, -0.1)

    expect(wrapped.currentIndex).toBe(1)
    expect(wrapped.nextIndex).toBe(0)
    expect(getSlideshowStateAtTime(2, Number.NaN)).toEqual(
      getSlideshowStateAtTime(2, 0),
    )
  })

  it('supports an immediate full-segment transition and a disabled transition', () => {
    expect(
      getSlideshowStateAtTime(2, 0.75, {
        holdDuration: 1,
        transitionDuration: 2,
      }).transitionProgress,
    ).toBeCloseTo(0.75)
    expect(
      getSlideshowStateAtTime(2, 0.99, { transitionDuration: 0 })
        .transitionProgress,
    ).toBe(0)
  })
})

describe('getSlideshowStateAtProgress', () => {
  it('maps normalized progress onto the same looping timeline', () => {
    expect(getSlideshowStateAtProgress(4, 0.25)).toEqual(
      getSlideshowStateAtTime(4, 1.5),
    )
    expect(getSlideshowStateAtProgress(4, 1)).toEqual(
      getSlideshowStateAtProgress(4, 0),
    )
    expect(getSlideshowStateAtProgress(4, -0.25)).toEqual(
      getSlideshowStateAtProgress(4, 0.75),
    )
  })
})

describe('calculateTransitionVisuals', () => {
  it.each([
    ['none', 0.5, [1, 0, 0, 0]],
    ['fade', 0.25, [0.75, 0.25, 0, 0]],
    ['slide', 0.25, [1, 1, -25, 75]],
  ] satisfies Array<[TransitionId, number, [number, number, number, number]]>)(
    'calculates %s transition parameters',
    (transition, progress, expected) => {
      const visuals = calculateTransitionVisuals(transition, progress)

      expect([
        visuals.currentOpacity,
        visuals.nextOpacity,
        visuals.currentTranslateXPercent,
        visuals.nextTranslateXPercent,
      ]).toEqual(expected)
    },
  )

  it('clamps visual progress and converges non-finite values', () => {
    expect(calculateTransitionVisuals('fade', 2)).toEqual({
      currentOpacity: 0,
      nextOpacity: 1,
      currentTranslateXPercent: 0,
      nextTranslateXPercent: 0,
    })
    expect(calculateTransitionVisuals('slide', Number.NaN)).toEqual({
      currentOpacity: 1,
      nextOpacity: 1,
      currentTranslateXPercent: 0,
      nextTranslateXPercent: 100,
    })
  })
})
