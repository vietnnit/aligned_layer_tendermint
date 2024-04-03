//! A simple script to generate and verify the proof of a given program.

use std::fs::File;

use sp1_core::{SP1Prover, SP1Stdin, SP1Verifier};

const ELF: &[u8] = include_bytes!("../elf/riscv32im-succinct-zkvm-elf");
const PROOF_FILE: &str = "program.proof";

fn main() {
    // Generate proof.
    let mut stdin = SP1Stdin::new();
    let n = 186u32;
    stdin.write(&n);
    let mut proof = SP1Prover::prove(ELF, stdin).expect("proving failed");

    // Read output.
    let a = proof.stdout.read::<u128>();
    let b = proof.stdout.read::<u128>();
    println!("a: {}", a);
    println!("b: {}", b);

    // Verify proof.
    SP1Verifier::verify(ELF, &proof).expect("verification failed");

    // Save proof.
    let proof_file = File::create(PROOF_FILE).expect("file creation failed");
    bincode::serialize_into(&proof_file, &proof).expect("file writing failed");

    println!("successfully generated and verified proof for the program!")
}
