use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

#[allow(dead_code)]
#[derive(Clone)]
pub struct RateLimiter {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    max_requests: usize,
    window_secs: u64,
}

#[allow(dead_code)]
impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            requests: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window_secs,
        }
    }

    pub async fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let mut requests = self.requests.lock().await;
        let entries = requests.entry(key.to_string()).or_insert_with(Vec::new);

        entries.retain(|t| now.duration_since(*t).as_secs() < self.window_secs);

        if entries.len() >= self.max_requests {
            return false;
        }

        entries.push(now);
        true
    }
}
