import { useState } from 'react';
export default function RiskCalculator() {
    const [values, setValues] = useState({
        balance: '100',
        percent: '1',
        stake: '1',
        payout: '',
        multiplier: '1',
        steps: '3',
        tp: '5',
        sl: '10',
    });
    const number = (key: keyof typeof values) => Number(values[key]);
    const stake = number('stake'),
        payout = number('payout');
    const valid =
        Object.entries(values).every(([key, value]) =>
            key === 'payout' ? true : value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0
        ) &&
        number('percent') <= 100 &&
        Number.isInteger(number('steps')) &&
        number('steps') <= 10 &&
        number('multiplier') >= 1 &&
        number('multiplier') <= 5;
    const quoted = values.payout.trim() !== '' && Number.isFinite(payout) && payout >= 0;
    const profit = payout - stake;
    let exposure = 0;
    const ladder = valid
        ? Array.from({ length: number('steps') + 1 }, (_, i) => {
              const amount = Math.ceil(stake * number('multiplier') ** i * 100) / 100;
              exposure += amount;
              return { amount, exposure };
          })
        : [];
    const field = (key: keyof typeof values, label: string) => (
        <label key={key}>
            {label}
            <input
                type='number'
                min={key === 'payout' ? 0 : 0.01}
                step={key === 'steps' ? 1 : 'any'}
                value={values[key]}
                onChange={e => setValues({ ...values, [key]: e.target.value })}
            />
        </label>
    );
    return (
        <section className='jt-page'>
            <p className='jt-eyebrow'>PLAN BEFORE YOU TRADE</p>
            <h1>Risk Calculator</h1>
            <p className='jt-lead'>
                Understand the exposure behind every stake. All amounts use the same account currency.
            </p>
            <div className='jt-split'>
                <div className='jt-card'>
                    <h2>Position & session planning</h2>
                    <div className='jt-fields'>
                        {field('balance', 'Planning balance')}
                        {field('percent', 'Risk per trade (%)')}
                        {field('stake', 'Stake')}
                        {field('payout', 'Expected total payout (optional)')}
                        {field('multiplier', 'Recovery multiplier (1–5)')}
                        {field('steps', 'Recovery steps (1–10)')}
                        {field('tp', 'Take profit')}
                        {field('sl', 'Stop loss / exposure budget')}
                    </div>
                    <p className='jt-note'>
                        Payout is your input, not a live quote. Recovery increases exposure and does not guarantee that
                        losses can be recovered.
                    </p>
                </div>
                <div className='jt-card' aria-live='polite'>
                    <h2>Your risk breakdown</h2>
                    {valid ? (
                        <>
                            <dl className='jt-metrics'>
                                <div>
                                    <dt>Risk-based stake</dt>
                                    <dd>{((number('balance') * number('percent')) / 100).toFixed(2)}</dd>
                                </div>
                                <div>
                                    <dt>Maximum loss per contract</dt>
                                    <dd>{stake.toFixed(2)}</dd>
                                </div>
                                <div>
                                    <dt>Potential payout</dt>
                                    <dd>{quoted ? payout.toFixed(2) : 'Enter a payout'}</dd>
                                </div>
                                <div>
                                    <dt>Potential net profit / loss</dt>
                                    <dd>{quoted ? profit.toFixed(2) : '—'}</dd>
                                </div>
                                <div>
                                    <dt>Risk : reward</dt>
                                    <dd>{quoted && profit > 0 ? `1 : ${(profit / stake).toFixed(2)}` : '—'}</dd>
                                </div>
                                <div>
                                    <dt>Break-even win rate</dt>
                                    <dd>{quoted && payout > 0 ? `${((stake / payout) * 100).toFixed(2)}%` : '—'}</dd>
                                </div>
                                <div>
                                    <dt>Wins toward target*</dt>
                                    <dd>{quoted && profit > 0 ? Math.ceil(number('tp') / profit) : '—'}</dd>
                                </div>
                                <div>
                                    <dt>Base-stake losses within budget</dt>
                                    <dd>{Math.floor(number('sl') / stake)}</dd>
                                </div>
                            </dl>
                            <h3>Consecutive-loss exposure</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Step</th>
                                        <th>Stake</th>
                                        <th>Total loss</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ladder.map((row, i) => (
                                        <tr key={i} className={row.exposure > number('sl') ? 'jt-danger' : ''}>
                                            <td>{i}</td>
                                            <td>{row.amount.toFixed(2)}</td>
                                            <td>
                                                {row.exposure.toFixed(2)}
                                                {row.exposure > number('sl') ? ' · exceeds budget' : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className='jt-note'>
                                *Assumes the same payout and no intervening losses. Targets are planning values, not
                                predictions.
                            </p>
                        </>
                    ) : (
                        <p role='alert'>
                            Enter positive finite amounts, risk up to 100%, 1–10 steps, and multiplier 1–5.
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
