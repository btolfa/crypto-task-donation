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

  it("Should initialize if payer and authority are the same", async () => {
    await program.methods.initialize(provider.wallet.publicKey)
        .accounts({
          payer: provider.wallet.publicKey,
          })
        .rpc();

    const [donationBank, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [provider.wallet.publicKey.toBuffer()], program.programId);

    const donationBankAccount = await program.account.donationBank.fetch(donationBank);
    expect(donationBankAccount.authority).to.be.deep.equal(provider.wallet.publicKey);
    expect(donationBankAccount.bump).to.be.equal(bump);
  });

  it("Should initialize if payer and authority are different", async () => {
    // The authority can be other program via CPI invocation
    const authority = anchor.web3.Keypair.generate();

    await program.methods.initialize(authority.publicKey)
        .accounts({
          payer: provider.wallet.publicKey,
        })
        .rpc();

    const [donationBank, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [authority.publicKey.toBuffer()], program.programId);

    const donationBankAccount = await program.account.donationBank.fetch(donationBank);
    expect(donationBankAccount.authority).to.be.deep.equal(authority  .publicKey);
    expect(donationBankAccount.bump).to.be.equal(bump);
  });

});
