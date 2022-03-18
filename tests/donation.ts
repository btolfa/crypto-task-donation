import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Donation } from "../target/types/donation";

import { expect } from 'chai';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

describe("donation", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());
  const provider = anchor.getProvider();
  const program = anchor.workspace.Donation as Program<Donation>;
  const donor1 = anchor.web3.Keypair.generate();
  const donor2 = anchor.web3.Keypair.generate();

  before(async () => {
    await provider.connection.requestAirdrop(donor1.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(donor2.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
  })

  async function find_donation_bank(authority: anchor.web3.PublicKey) {
    const [donationBank, _bump] = await anchor.web3.PublicKey.findProgramAddress(
        [authority.toBuffer()], program.programId);
    return donationBank
  }

  async function find_registry(authority: anchor.web3.PublicKey, donor: anchor.web3.PublicKey) {
    const [donationBank, _donationBankBump] = await anchor.web3.PublicKey.findProgramAddress(
        [authority.toBuffer()], program.programId);
    const [registry, _registryBump] = await anchor.web3.PublicKey.findProgramAddress(
        [donationBank.toBuffer(), donor.toBuffer()], program.programId
    );
    return registry;
  }

  it("Should initialize if payer and authority are the same", async () => {
    await program.methods.initialize(provider.wallet.publicKey)
        .accounts({
          payer: provider.wallet.publicKey,
          })
        .rpc();

    const [donationBank, _bump] = await anchor.web3.PublicKey.findProgramAddress(
        [provider.wallet.publicKey.toBuffer()], program.programId);

    const donationBankAccount = await program.account.donationBank.fetch(donationBank);
    expect(donationBankAccount.authority).to.be.deep.equal(provider.wallet.publicKey);
  });

  it("Should initialize if payer and authority are different", async () => {
    // The authority can be other program via CPI invocation
    const authority = anchor.web3.Keypair.generate();

    await program.methods.initialize(authority.publicKey)
        .accounts({
          payer: provider.wallet.publicKey,
        })
        .rpc();

    const [donationBank, _bump] = await anchor.web3.PublicKey.findProgramAddress(
        [authority.publicKey.toBuffer()], program.programId);

    const donationBankAccount = await program.account.donationBank.fetch(donationBank);
    expect(donationBankAccount.authority).to.be.deep.equal(authority  .publicKey);
  });

  it("Should make a donation -> transfer lamports, create registry PDA, emit event", async () => {
    const donationBank = await find_donation_bank(provider.wallet.publicKey);
    const donationBankBalanceBefore = await provider.connection.getBalance(donationBank);

    const registry = await find_registry(provider.wallet.publicKey, donor1.publicKey);
    let registryAccount = await program.account.registry.fetchNullable(registry);
    expect(registryAccount).to.be.null;

    let listener = null;
    let [event, slot] = await new Promise((resolve, _reject) => {
      listener = program.addEventListener("DonationEvent", (event, slot) => {
        resolve([event, slot]);
      });
      program.methods.makeDonation(new anchor.BN(10000))
          .accounts({
            donationBank,
            donor: donor1.publicKey,
          })
          .signers([donor1])
          .rpc();
    });
    await program.removeEventListener(listener);

    expect(slot).to.gt(0);
    expect(event.donationBank).to.be.deep.equal(donationBank);
    expect(event.donor).to.be.deep.equal(donor1.publicKey);
    expect(event.amount.toNumber()).to.be.deep.equal(10000);

    registryAccount = await program.account.registry.fetch(registry);
    expect(registryAccount.donor).to.be.deep.equal(donor1.publicKey);
    expect(registryAccount.amount.toNumber()).to.be.equal(10000);

    const donationBankBalanceAfter = await provider.connection.getBalance(donationBank);
    expect(donationBankBalanceAfter - donationBankBalanceBefore).to.be.equal(10000);
  });

  it("Should make a donation multiple times -> transfer lamports, create registry PDA, emit event", async () => {
    const donationBank = await find_donation_bank(provider.wallet.publicKey);
    const donationBankBalanceBefore = await provider.connection.getBalance(donationBank);

    const registry = await find_registry(provider.wallet.publicKey, donor2.publicKey);
    let registryAccount = await program.account.registry.fetchNullable(registry);
    expect(registryAccount).to.be.null;

    // First donation
    await program.methods.makeDonation(new anchor.BN(10000))
        .accounts({
          donationBank,
          donor: donor2.publicKey,
        })
        .signers([donor2])
        .rpc();

    registryAccount = await program.account.registry.fetch(registry);
    expect(registryAccount.donor).to.be.deep.equal(donor2.publicKey);
    expect(registryAccount.amount.toNumber()).to.be.equal(10000);

    let donationBankBalanceAfter = await provider.connection.getBalance(donationBank);
    expect(donationBankBalanceAfter - donationBankBalanceBefore).to.be.equal(10000);

    // Second donation
    await program.methods.makeDonation(new anchor.BN(20000))
        .accounts({
          donationBank,
          donor: donor2.publicKey,
        })
        .signers([donor2])
        .rpc();

    registryAccount = await program.account.registry.fetch(registry);
    expect(registryAccount.donor).to.be.deep.equal(donor2.publicKey);
    expect(registryAccount.amount.toNumber()).to.be.equal(30000);

    donationBankBalanceAfter = await provider.connection.getBalance(donationBank);
    expect(donationBankBalanceAfter - donationBankBalanceBefore).to.be.equal(30000);
  });

  it("Should NOT make a donation if amount is zero", async () => {
    const donationBank = await find_donation_bank(provider.wallet.publicKey);
    await expect(program.methods.makeDonation(new anchor.BN(0))
        .accounts({
          donationBank,
          donor: donor1.publicKey,
        })
        .signers([donor1])
        .rpc()).to.be.rejectedWith(/amount should be more than zero/);
  });

  it("Should NOT make a donation if insufficient lamports", async () => {
    const donor3 = anchor.web3.Keypair.generate();
    const donationBank = await find_donation_bank(provider.wallet.publicKey);
    await expect(program.methods.makeDonation(new anchor.BN(10000))
        .accounts({
          donationBank,
          donor: donor3.publicKey,
        })
        .signers([donor3])
        .rpc()).to.be.rejected;
  });

  /*
  it("Should fetch all registry PDA", async () => {
    // TODO: how to filter?
    expect(0).to.be.equal(1);
    //program.account.registry.all()
  });*/

  it("Should withdraw -> transfer lamports, leave rent exempt, emit event", async () => {
    const destination = anchor.web3.Keypair.generate();
    const rentExemptionDest = await provider.connection.getMinimumBalanceForRentExemption(0);
    const rentExemptionBank = await provider.connection.getMinimumBalanceForRentExemption(32 + 8);

    const donationBank = await find_donation_bank(provider.wallet.publicKey);
    const bankBefore = await provider.connection.getBalance(donationBank);

      let listener = null;
      let [event, slot] = await new Promise((resolve, _reject) => {
          listener = program.addEventListener("WithdrawEvent", (event, slot) => {
              resolve([event, slot]);
          });
          program.methods.withdraw()
              .accounts({
                  donationBank: donationBank,
                  authority: provider.wallet.publicKey,
                  destination: destination.publicKey,
              })
              .preInstructions([anchor.web3.SystemProgram.transfer({
                  fromPubkey: provider.wallet.publicKey,
                  toPubkey: destination.publicKey,
                  lamports: rentExemptionDest,
              })])
              .rpc();
      });
    await program.removeEventListener(listener);

    const bankAfter = await provider.connection.getBalance(donationBank);
    const destAfter = await provider.connection.getBalance(destination.publicKey);

    expect(bankAfter).to.be.equal(rentExemptionBank);
    expect(destAfter).to.be.equal(bankBefore - bankAfter + rentExemptionDest);

    expect(slot).to.gt(0);
    expect(event.donationBank).to.be.deep.equal(donationBank);
    expect(event.destination).to.be.deep.equal(destination.publicKey);
    expect(event.amount.toNumber()).to.be.deep.equal(bankBefore - bankAfter);
  });
});
