import { test, expect } from '@playwright/test';
import { nestPanels } from '../src/cad/panel-nesting.js';

test('nests repeated parts and reports sheet placements', () => {
  const plan=nestPanels([{id:'side',label:'جنب خزانة',widthMm:400,lengthMm:700,qty:2,thicknessMm:18}],{widthMm:1220,heightMm:2440,thicknessMm:18},{marginMm:10,kerfMm:3});
  expect(plan.sheetCount).toBe(1);
  expect(plan.placedParts).toBe(2);
  expect(plan.sheets[0].placements).toHaveLength(2);
  expect(plan.sheets[0].placements[1].yMm).toBe(plan.sheets[0].placements[0].yMm);
});

test('respects grain direction and only rotates when allowed', () => {
  const part={widthMm:600,lengthMm:900,qty:1,thicknessMm:18};
  const stock={widthMm:1000,heightMm:700,thicknessMm:18};
  const locked=nestPanels([{...part,grainDirection:'length'}],stock,{marginMm:0,kerfMm:0});
  expect(locked.placedParts).toBe(0);
  const free=nestPanels([{...part,grainDirection:'none'}],stock,{marginMm:0,kerfMm:0});
  expect(free.placedParts).toBe(1);
  expect(free.sheets[0].placements[0].rotated).toBe(true);
});

test('accounts for saw kerf when checking fit', () => {
  const plan=nestPanels([{widthMm:98,lengthMm:98,qty:1,thicknessMm:18}],{widthMm:100,heightMm:100,thicknessMm:18},{marginMm:0,kerfMm:3});
  expect(plan.placedParts).toBe(0);
  expect(plan.unplaced[0].reason).toContain('أكبر');
});

test('rejects mixed board thickness instead of silently combining stock', () => {
  expect(()=>nestPanels([{widthMm:200,lengthMm:300,thicknessMm:15}],{widthMm:1220,heightMm:2440,thicknessMm:18})).toThrow(/سماكة/);
});

test('rejects invalid stock dimensions', () => {
  expect(()=>nestPanels([{widthMm:200,lengthMm:300}],{widthMm:0,heightMm:2440,thicknessMm:18})).toThrow();
});
