import { useState } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, CreditCard, ChevronLeft, Percent, Printer, Banknote, Smartphone } from 'lucide-react';
import './Cart.css';

const PAYMENT_METHODS = [
    { id: 'especes', label: 'Espèces', icon: '💵' },
    { id: 'cb', label: 'CB', icon: '💳' },
    { id: 'cheque', label: 'Chèque', icon: '📝' },
];

export default function Cart({ items, updateQuantity, clearCart, onCheckout }) {
    const [checkoutMode, setCheckoutMode] = useState(false);
    const [discount, setDiscount] = useState(0);
    const [amountGiven, setAmountGiven] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('especes');

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = subtotal * (discount / 100);
    const total = subtotal - discountAmount;

    let change = 0;
    const amountGivenNum = parseFloat(amountGiven.replace(',', '.'));
    if (paymentMethod === 'especes' && !isNaN(amountGivenNum) && amountGivenNum >= total) {
        change = amountGivenNum - total;
    }

    const isAmountEntered = amountGiven.trim() !== '';
    const isAmountInsufficient = isAmountEntered && (isNaN(amountGivenNum) || amountGivenNum < total);

    const handleConfirmCheckout = () => {
        onCheckout({
            subtotal,
            discount: discountAmount,
            total,
            amountGiven: paymentMethod === 'especes' ? (amountGivenNum || total) : total,
            change,
            paymentMethod
        });
        setCheckoutMode(false);
        setDiscount(0);
        setAmountGiven('');
        setPaymentMethod('especes');

        const methodLabel = PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || paymentMethod;
        alert(`--- TICKET DE CAISSE ---\nTotal : ${total.toFixed(2)} €\nPaiement : ${methodLabel}${paymentMethod === 'especes' ? `\nMonnaie rendue : ${change.toFixed(2)} €` : ''}\n------------------------`);
    };

    if (checkoutMode) {
        return (
            <div className="cart-container">
                <div className="cart-header">
                    <button className="back-btn" onClick={() => setCheckoutMode(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                        <ChevronLeft size={20} /> Retour
                    </button>
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Encaissement</h2>
                </div>

                <div className="checkout-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>

                    {/* Discount */}
                    <div className="invoice-section">
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Percent size={16} /> Remise Globale
                        </h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[0, 10, 20].map(d => (
                                <button key={d}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${discount === d ? 'var(--color-primary)' : 'var(--color-border)'}`, backgroundColor: discount === d ? 'var(--color-primary-light)' : 'transparent', color: discount === d ? 'var(--color-primary-dark)' : 'inherit', fontWeight: 600, cursor: 'pointer' }}
                                    onClick={() => setDiscount(d)}
                                >
                                    {d === 0 ? 'Aucune' : `-${d}%`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Total Summary */}
                    <div className="invoice-section" style={{ backgroundColor: 'var(--color-background)', padding: '16px', borderRadius: '12px' }}>
                        <div className="summary-row"><span>Sous-total</span><span>{subtotal.toFixed(2)} €</span></div>
                        {discount > 0 && (
                            <div className="summary-row" style={{ color: '#ef4444' }}>
                                <span>Remise (-{discount}%)</span><span>-{discountAmount.toFixed(2)} €</span>
                            </div>
                        )}

                        <div className="summary-row total" style={{ fontSize: '1.2rem', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                            <span>Total à payer</span>
                            <span style={{ color: 'var(--color-primary)' }}>{total.toFixed(2)} €</span>
                        </div>
                    </div>

                    {/* ── Payment Method ── */}
                    <div className="invoice-section">
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Moyen de paiement</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            {PAYMENT_METHODS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setPaymentMethod(m.id)}
                                    style={{
                                        padding: '14px 8px',
                                        borderRadius: '12px',
                                        border: `2px solid ${paymentMethod === m.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                        backgroundColor: paymentMethod === m.id ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                        color: paymentMethod === m.id ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Cash Calculator (Espèces only) ── */}
                    {paymentMethod === 'especes' && (
                        <div className="invoice-section">
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Espèces données par le client</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={amountGiven}
                                    onChange={e => setAmountGiven(e.target.value)}
                                    placeholder="Montant perçu..."
                                    style={{ width: '100%', padding: '16px', paddingRight: '40px', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '1.2rem', fontWeight: 600, outline: 'none' }}
                                />
                                <span style={{ position: 'absolute', right: '16px', fontSize: '1.2rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>€</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                                {[5, 10, 20, 30, 40, 50].map(val => (
                                    <button key={val}
                                        style={{ flex: 1, minWidth: '60px', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', fontWeight: 500 }}
                                        onClick={() => setAmountGiven(val.toString())}
                                    >
                                        {val}€
                                    </button>
                                ))}
                                <button
                                    style={{ flex: 1, minWidth: '60px', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', cursor: 'pointer', fontWeight: 600 }}
                                    onClick={() => setAmountGiven(Math.ceil(total).toString())}
                                >
                                    Pile
                                </button>
                                <button
                                    style={{ flex: 1, minWidth: '60px', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', fontWeight: 500, color: '#ef4444' }}
                                    onClick={() => setAmountGiven('')}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Change display */}
                    {paymentMethod === 'especes' && isAmountEntered && !isAmountInsufficient && (
                        <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>Monnaie à rendre :</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{change.toFixed(2)} €</span>
                        </div>
                    )}
                    {paymentMethod === 'especes' && isAmountInsufficient && (
                        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500, textAlign: 'center' }}>
                            Le montant perçu est insuffisant.
                        </div>
                    )}
                    {paymentMethod === 'cb' && (
                        <div style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '14px', borderRadius: '12px', textAlign: 'center', fontWeight: 600 }}>
                            💳 Paiement par carte bancaire — {total.toFixed(2)} €
                        </div>
                    )}
                    {paymentMethod === 'cheque' && (
                        <div style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '14px', borderRadius: '12px', textAlign: 'center', fontWeight: 600 }}>
                            📝 Paiement par chèque — {total.toFixed(2)} €
                        </div>
                    )}
                </div>

                <div className="cart-footer" style={{ borderTop: '1px solid var(--color-border)', padding: '24px' }}>
                    <button
                        className="btn-primary checkout-btn"
                        disabled={paymentMethod === 'especes' && isAmountInsufficient}
                        onClick={handleConfirmCheckout}
                        style={{ display: 'flex', justifyContent: 'center', gap: '12px', width: '100%', alignItems: 'center' }}
                    >
                        <Printer size={20} /> Valider & Imprimer
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="cart-container">
            <div className="cart-header">
                <div className="cart-title">
                    <ShoppingBag size={24} color="var(--color-primary)" />
                    <h2>Commande en cours</h2>
                </div>
                {items.length > 0 && (
                    <button className="clear-btn" onClick={clearCart}>
                        <Trash2 size={20} />
                    </button>
                )}
            </div>

            <div className="cart-items">
                {items.length === 0 ? (
                    <div className="empty-cart">
                        <ShoppingBag size={48} color="var(--color-border)" />
                        <p>Le panier est vide</p>
                    </div>
                ) : (
                    items.map(item => (
                        <div key={item.id} className="cart-item">
                            <div className="item-details">
                                <span className="item-name">{item.name}</span>
                                <span className="item-price">{(item.price * item.quantity).toFixed(2)} €</span>
                            </div>
                            <div className="quantity-controls">
                                <button onClick={() => updateQuantity(item.id, -1)} className="qty-btn"><Minus size={16} /></button>
                                <span className="qty-value">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn"><Plus size={16} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="cart-footer">
                <div className="summary-row"><span>Sous-total</span><span>{subtotal.toFixed(2)} €</span></div>

                <div className="summary-row total"><span>Total à payer</span><span>{total.toFixed(2)} €</span></div>
                <button className="btn-primary checkout-btn" disabled={items.length === 0} onClick={() => setCheckoutMode(true)}>
                    <CreditCard size={20} /> Passer à l'encaissement
                </button>
            </div>
        </div>
    );
}
