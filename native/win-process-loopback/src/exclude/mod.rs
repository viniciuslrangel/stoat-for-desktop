use std::collections::BTreeSet;

// WASAPI accepts one process-loopback target per activation. For two or more
// exclusion roots, the mixer captures the default render endpoint and
// subtracts one INCLUDE_TARGET_PROCESS_TREE stream for each root.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Strategy {
    IncludeTree { pid: u32 },
    NativeExcludeTree { exclusion_root: u32 },
    Subtractive { exclusion_roots: Vec<u32> },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CapturePlan {
    pub target_pid: u32,
    pub strategy: Strategy,
}

impl CapturePlan {
    pub fn parse(mode: &str, pid: u32, exclude_pids: &[u32]) -> Result<Self, String> {
        if pid == 0 {
            return Err("invalid process id".to_string());
        }
        if exclude_pids.iter().any(|value| *value == 0) {
            return Err("invalid exclusion process id".to_string());
        }
        match mode {
            "includeTree" => {
                if !exclude_pids.is_empty() {
                    return Err("includeTree does not accept excludePids".to_string());
                }
                Ok(Self {
                    target_pid: pid,
                    strategy: Strategy::IncludeTree { pid },
                })
            }
            "excludeTrees" => {
                let mut roots = BTreeSet::new();
                roots.extend(exclude_pids.iter().copied());
                let exclusion_roots = roots.into_iter().collect::<Vec<_>>();
                match exclusion_roots.as_slice() {
                    [exclusion_root] => Ok(Self {
                        target_pid: pid,
                        strategy: Strategy::NativeExcludeTree {
                            exclusion_root: *exclusion_root,
                        },
                    }),
                    [] => Err("excludeTrees requires an exclusion process id".to_string()),
                    _ => {
                        // The Windows process-loopback activation contract has
                        // one TargetProcessId, not a list. For multiple roots,
                        // capture the default render loopback and subtract
                        // one include-tree capture per root. Packet boundaries
                        // differ between clients, so the mixer aligns queues
                        // by available frame counts instead of subtracting
                        // raw WASAPI packet arrays.
                        Ok(Self {
                            target_pid: pid,
                            strategy: Strategy::Subtractive { exclusion_roots },
                        })
                    }
                }
            }
            _ => Err(format!("invalid capture mode: {mode}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{CapturePlan, Strategy};

    #[test]
    fn selects_native_exclusion_for_one_root() {
        let plan = CapturePlan::parse("excludeTrees", 10, &[20, 20]).unwrap();
        assert_eq!(
            plan.strategy,
            Strategy::NativeExcludeTree { exclusion_root: 20 }
        );
    }

    #[test]
    fn selects_subtractive_mixing_for_multiple_roots() {
        let plan = CapturePlan::parse("excludeTrees", 10, &[30, 20, 30]).unwrap();
        assert_eq!(
            plan.strategy,
            Strategy::Subtractive {
                exclusion_roots: vec![20, 30]
            }
        );
    }

    #[test]
    fn rejects_empty_exclusion_roots() {
        assert!(CapturePlan::parse("excludeTrees", 10, &[]).is_err());
    }
}
