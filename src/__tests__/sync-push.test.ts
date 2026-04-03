import { expect, test, describe, vi } from 'vitest';
import { POST } from '../app/api/sync/push/route';

// Mock NEXT server and Auth
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue({ value: 'fake-token' })
  })
}));

vi.mock('../lib/auth', () => ({
  verifyToken: vi.fn(() => Promise.resolve({ uid: 'user_123' }))
}));

// Mock Prisma
const mockUpsert = vi.fn();
const mockDeleteMany = vi.fn();
vi.mock('../lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (callback) => {
       const tx = {
          task: { upsert: mockUpsert, deleteMany: mockDeleteMany }
       };
       await callback(tx);
    })
  }
}));

describe('Sync API /api/sync/push', () => {
    test('Should process empty ops correctly', async () => {
       const req = new Request('http://localhost/api/sync/push', { 
           method: 'POST', 
           body: JSON.stringify({ ops: [] }) 
       });
       const res = await POST(req);
       expect(res.status).toBe(200);
       const json = await res.json();
       expect(json.count).toBe(0);
       expect(json.success).toBe(true);
    });

    test('Should process valid queue items', async () => {
        const ops = [
            { table: 'tasks', action: 'create', recordId: 8, payload: { title: 'Hello', act_time: 1 } },
            { table: 'tasks', action: 'delete', recordId: 9 }
        ];
        const req = new Request('http://localhost/api/sync/push', { 
            method: 'POST', 
            body: JSON.stringify({ ops }) 
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        
        expect(mockUpsert).toHaveBeenCalled();
        expect(mockDeleteMany).toHaveBeenCalledWith({
            where: { userId: 'user_123', local_id: 9 }
        });
    });
});
