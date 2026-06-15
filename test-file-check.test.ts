import { test, expect } from 'vitest';

test('check file type', () => {
  const f = new File([], 'test.pdf', { type: 'application/pdf' });
  const fd = new FormData();
  fd.append('file', f);
  const file = fd.get('file');
  console.log('typeof file:', typeof file);
  console.log('file instanceof File:', file instanceof File);
  console.log('file instanceof Blob:', file instanceof Blob);
  console.log('file size:', (file as any)?.size);
  console.log('file type:', typeof (file as any)?.size);
  expect(true).toBe(true);
});
