import { db } from './db';
import { SyncQueueItem } from './types';

// Global flag to prevent sync hooks from firing during massive downward sync operations
let isPullingCloud = false;

export const SyncService = {
  setPullingState(isPulling: boolean) {
    isPullingCloud = isPulling;
  },

  bootstrapSyncHooks() {
    const tables = ['tasks', 'execution_logs', 'daily_anchors', 'habit_templates', 'goals', 'goal_comments'] as const;
    
    tables.forEach(tableName => {
      db[tableName].hook('creating', function(primKey, obj, trans) {
        if (isPullingCloud || !primKey) return;
        trans.table('sync_queue').add({ 
            table: tableName, 
            action: 'create', 
            recordId: primKey.toString(),
            payload: obj, 
            created_at: new Date().toISOString() 
        });
        SyncService.triggerSync();
      });

      db[tableName].hook('updating', function(mods, primKey, obj, trans) {
        if (isPullingCloud || !primKey) return;
        trans.table('sync_queue').add({ 
            table: tableName, 
            action: 'update', 
            recordId: primKey.toString(),
            payload: { ...obj, ...mods }, 
            created_at: new Date().toISOString() 
        });
        SyncService.triggerSync();
      });

      db[tableName].hook('deleting', function(primKey, obj, trans) {
        if (isPullingCloud || !primKey) return;
        trans.table('sync_queue').add({ 
            table: tableName, 
            action: 'delete', 
            recordId: primKey.toString(),
            created_at: new Date().toISOString() 
        });
        SyncService.triggerSync();
      });
    });

    // Auto-retry on network reconnect
    if (typeof window !== 'undefined') {
      window.addEventListener('online', SyncService.triggerSync);
    }
  },

  syncTimeout: null as any,

  triggerSync() {
    if (typeof window === 'undefined') return;
    
    if (SyncService.syncTimeout) {
      clearTimeout(SyncService.syncTimeout);
    }

    SyncService.syncTimeout = setTimeout(async () => {
       if (!navigator.onLine) return;

       // 检查当前是否是登录状态 (使用 cookie 获取或请求 API)
       // 出于性能考虑，此处可以直接依靠 cookie 由服务端 401 拦截
       
       try {
         const ops = await db.sync_queue.orderBy('id').toArray();
         if (ops.length === 0) return;
         
         const res = await fetch('/api/sync/push', { 
             method: 'POST', 
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ ops }) 
         });

         if (res.ok) {
            // 删除成功同步的操作记录
            const opIds = ops.map(o => o.id as number);
            await db.sync_queue.bulkDelete(opIds);
            window.dispatchEvent(new Event('pace_sync_success'));
         } else if (res.status === 401) {
            // 未登录，清空队列不再触发
            await db.sync_queue.clear();
         }
       } catch (e) {
         console.warn("Background sync failed, will retry later", e);
       }
    }, 2000); // 2 second debounce to batch rapid local edits
  }
};
