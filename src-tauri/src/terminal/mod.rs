use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;

mod event;
pub mod grid;
pub mod instance;

use grid::CellData;
use instance::TerminalInstance;

#[derive(Serialize, Clone)]
pub struct CursorPos {
    pub row: u16,
    pub col: u16,
}

#[derive(Serialize, Clone)]
pub struct TerminalCellsPayload {
    pub id: String,
    pub cells: Vec<CellData>,
    pub cursor: CursorPos,
}

pub struct TerminalManager {
    instances: Mutex<HashMap<String, TerminalInstance>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
        }
    }

    pub fn insert(&self, id: String, instance: TerminalInstance) {
        self.instances.lock().unwrap().insert(id, instance);
    }

    pub fn remove(&self, id: &str) {
        self.instances.lock().unwrap().remove(id);
    }

    /// bytes を advance し、damage があればセルグリッドを返す
    pub fn advance_and_collect(&self, id: &str, bytes: &[u8]) -> Option<TerminalCellsPayload> {
        let mut instances = self.instances.lock().unwrap();
        let instance = instances.get_mut(id)?;
        instance.advance(bytes);
        let (cells, cursor) = instance.collect_damage()?;
        Some(TerminalCellsPayload {
            id: id.to_string(),
            cells,
            cursor,
        })
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) {
        let mut instances = self.instances.lock().unwrap();
        if let Some(instance) = instances.get_mut(id) {
            instance.resize(cols, rows);
        }
    }
}
