/**
 * Whitepaper-style overview for judges and newcomers.
 * Content aligns with docs/PROJECT_SPEC.md — not a legal prospectus.
 */
export function ExplanationTab() {
  return (
    <article className="whitepaper" aria-labelledby="wp-title">
      <header className="whitepaper__masthead">
        <p className="whitepaper__series">Technical overview</p>
        <h1 id="wp-title" className="whitepaper__title">
          DAO Agent — pooled treasury, voter targets, and bounded automation
        </h1>
        <p className="whitepaper__abstract">
          <strong>Abstract.</strong> We describe a vault on Base where depositors hold pro-rata shares of a shared
          portfolio. Each allocation cycle, stakeholders submit target weights over an allowlisted asset set; votes are
          aggregated with power proportional to <em>share × trust</em>. An autonomous executor moves holdings toward the
          blended target only when drift exceeds configurable bands—reducing churn and gas—while swaps remain subject to
          on-chain allowlists and slippage floors. Trust updates from retrospective portfolio performance vs a benchmark;
          positive cycle profits can be attributed with trust-skewed weights, while losses impair everyone through the
          share price. This interface is a read/write dashboard for deposits, ballots, history, and exits; the agent and
          trust pipeline run off-chain with auditable exports.
        </p>
      </header>

      <section className="whitepaper__section">
        <h2>
          <span className="whitepaper__secno">1</span> Motivation
        </h2>
        <p>
          Passive holders rarely rebalance; one-person-one-vote ignores track record; dollar-weighted voting ignores
          governance quality. A pooled vehicle with <strong>transparent rules</strong>, <strong>snapshot voting</strong>,
          and <strong>delegated execution</strong> under caps addresses all three—without giving the bot unchecked
          custody of arbitrary assets.
        </p>
      </section>

      <section className="whitepaper__section">
        <h2>
          <span className="whitepaper__secno">2</span> System overview
        </h2>
        <p>
          The <strong>DAOVault</strong> contract holds allowlisted ERC-20s, mints/burns share tokens, and exposes
          governance roles (pause, executor, parameter updates). Users <strong>deposit</strong> or{" "}
          <strong>redeem</strong> pro-rata or to a single asset via documented router paths.{" "}
          <strong>Allocation ballots</strong> are emitted on-chain; the aggregate target for the active cycle is derived
          from those events plus exported vote/trust data. An <strong>off-chain agent</strong> reads vault state and
          targets, runs <code className="whitepaper__code">plan</code> against band policy, then may submit{" "}
          <code className="whitepaper__code">rebalance</code> transactions that swap inside Uniswap routes allowed by the
          vault.
        </p>
        <figure className="whitepaper__figure" aria-label="Data flow diagram">
          <pre className="whitepaper__ascii">
            {`  Voters ──► snapshot / aggregate ──► blended targets
                │                                    │
                ▼                                    ▼
         trust CSV / scores ◄──── finalize ◄── closeCycle / NAV
                │                                    │
                └──────────────► agent: plan ──► rebalance ──► Base + DEX`}
          </pre>
        </figure>
      </section>

      <section className="whitepaper__section">
        <h2>
          <span className="whitepaper__secno">3</span> Cycles, quorum, and snapshots
        </h2>
        <p>
          Time is divided into <strong>cycles</strong> with a configurable wall-clock schedule (compressed on testnet
          for demos). Within a voting window, eligible holders—those in the share snapshot—cast weights over{" "}
          <strong>ballot assets</strong>. A <strong>quorum</strong> on participation can gate whether exported targets
          feed the agent. After voting closes, a frozen phase allows the aggregate to stabilize before execution and
          rollover. New depositors who arrive after the snapshot vote in the <em>next</em> cycle, which keeps the rule
          simple and fair.
        </p>
      </section>

      <section className="whitepaper__section">
        <h2>
          <span className="whitepaper__secno">4</span> Aggregation and trust-weighted power
        </h2>
        <p>
          Each ballot carries normalized weights; off-chain aggregation blends ballots using voting power ≈{" "}
          <strong>shares × trust multiplier</strong>. The UI shows per-asset targets as a pie chart consistent with
          on-chain ballot ordering. <strong>Trust</strong> is computed in a pipeline (CSV / JSON exports) from how each
          voter&apos;s proposed portfolio would have performed vs the benchmark path documented for the build; scores feed
          the leaderboard and the aggregate.
        </p>
      </section>

      <section className="whitepaper__section">
        <h2>
          <span className="whitepaper__secno">5</span> Execution: bands, quotes, and the executor
        </h2>
        <p>
          The agent does not chase every basis point. <strong>Rebalance bands</strong> (global ε, optional per-asset
          floors, optional minimum notional) suppress swaps whose only purpose is tiny drift—documented in the repo&apos;s
          band policy. When a trade is warranted, routes use Uniswap V3-style quoting (
          <code className="whitepaper__code">QuoterV2</code>) with <code className="whitepaper__code">minAmountOut</code>{" "}
          protection; oracle vs pool guards apply on sensitive pairs. The <strong>executor</strong> role is a scoped
          actor: it can only invoke approved routers and paths the vault encodes.
        </p>
      </section>

      <section className="whitepaper__section">
        <h2>
          <span className="whitepaper__secno">6</span> Profits, P&amp;L attribution, and scope
        </h2>
        <p>
          Per-cycle vault P&amp;L is tied to <code className="whitepaper__code">closeCycle</code> and off-chain exports.
          <strong> Tier A</strong> (shipped for the hackathon) attributes positive results with weights ∝{" "}
          <em>trust × shares</em>; losses flow through pro-rata impairment—trust does not amplify downside.{" "}
          <strong>Tier B</strong> (deposit-adjusted accounting, optional Merkle claims) remains future work. Multi-asset
          routing beyond the documented WETH/USDC-heavy paths may require additional swap topology for production-scale
          diversification.
        </p>
      </section>

      <section className="whitepaper__section">
        <h2>
          <span className="whitepaper__secno">7</span> Risks and disclosures
        </h2>
        <p>
          This software is an <strong>experimental prototype</strong> for a hackathon: not investment advice, not
          audited for production TVL. Oracle lag, liquidity, and MEV remain real; governance may be simplified to EOA
          roles on testnet. Read the repository <strong>PROOF</strong>, <strong>BUILD_LOG</strong>, and deployment notes
          for the exact deployment you are judging.
        </p>
      </section>

      <footer className="whitepaper__footer">
        <p>
          DAO Agent / DAOVault — Synthesis build. For implementation detail see the repository specification and vault
          design documents.
        </p>
      </footer>
    </article>
  );
}
