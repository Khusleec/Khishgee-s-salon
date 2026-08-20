'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, type AuthResponse, type ForgotResponse } from './lib';
import { useShop } from './store';

function AuthForm({ mode }: { mode: 'login' | 'reg' }) {
  const { setUser, closeModal, toast, openAuth, openForgot } = useShop();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const r = await api<AuthResponse>(mode === 'login' ? '/api/auth/login' : '/api/auth/register', { method: 'POST', body: f });
      setUser(r.user);
      closeModal();
      toast(`Сайн байна уу, ${r.user.name}!`, 'ok');
    } catch (err) {
      toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-head">
        <div className="center">
          <span className="logo-mark" style={{ margin: '0 auto 12px' }}>K</span>
          <h2 style={{ fontSize: '1.4rem' }}>Тавтай морил</h2>
          <p className="muted" style={{ fontSize: '.9rem', margin: '4px 0 0' }}>Захиалгаа хянах, хаягаа хадгалах</p>
        </div>
      </div>
      <div className="modal-body">
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => openAuth('login')}>Нэвтрэх</button>
          <button type="button" className={mode === 'reg' ? 'on' : ''} onClick={() => openAuth('reg')}>Бүртгүүлэх</button>
        </div>
        <form id="authForm" onSubmit={submit}>
          <div className="field" id="nameField" hidden={mode === 'login'}>
            <label>Овог нэр</label><input name="name" placeholder="Б. Сарантуяа" />
          </div>
          <div className="field"><label>Утасны дугаар</label>
            <input name="phone" inputMode="numeric" maxLength={8} placeholder="99112233" required /></div>
          <div className="field"><label>Нууц үг</label>
            <input name="password" type="password" placeholder="••••••" required minLength={6} /></div>
          <button className="btn btn-lg btn-block" type="submit" id="authSubmit" disabled={busy}>
            {mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
          </button>
        </form>
        {mode === 'login' ? (
          <p style={{ textAlign: 'center', margin: '12px 0 0' }}>
            <button
              type="button"
              className="link-more"
              id="forgotLink"
              style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}
              onClick={() => openForgot()}
            >Нууц үгээ мартсан уу?</button>
          </p>
        ) : null}
        <p className="muted" style={{ fontSize: '.8rem', textAlign: 'center', margin: '14px 0 0' }}>
          Туршилтын хэрэглэгч: <b>99001122</b> / <b>test1234</b></p>
      </div>
    </>
  );
}

function ForgotForm({ step, phone, mockCode }: { step: 1 | 2; phone: string; mockCode: string }) {
  const { setUser, closeModal, toast, openAuth, openForgot } = useShop();
  const [busy, setBusy] = useState(false);

  const submitPhone = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const p = String(new FormData(e.currentTarget).get('phone') || '').replace(/\D/g, '');
    if (p.length !== 8) { toast('Утасны дугаар 8 оронтой байх ёстой', 'err'); return; }
    setBusy(true);
    try {
      const r = await api<ForgotResponse>('/api/auth/forgot', { method: 'POST', body: { phone: p } });
      toast(r.message, 'ok');
      openForgot(2, p, r.code || '');
    } catch (err) {
      toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  const submitReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (f.password !== f.password2) { toast('Нууц үг хоорондоо таарахгүй байна', 'err'); return; }
    setBusy(true);
    try {
      const r = await api<AuthResponse>('/api/auth/reset', { method: 'POST', body: { phone, code: f.code, password: f.password } });
      setUser(r.user);
      closeModal();
      toast('Нууц үг шинэчлэгдлээ. Тавтай морил!', 'ok');
    } catch (err) {
      toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-head">
        <div className="center">
          <span className="logo-mark" style={{ margin: '0 auto 12px' }}>K</span>
          <h2 style={{ fontSize: '1.4rem' }}>Нууц үг сэргээх</h2>
          <p className="muted" style={{ fontSize: '.9rem', margin: '4px 0 0' }}>
            {step === 1 ? 'Бүртгэлтэй утасны дугаараа оруулна уу' : <><b>{phone}</b> дугаарт илгээсэн кодыг оруулна уу</>}
          </p>
        </div>
      </div>
      <div className="modal-body">
        {step === 1 ? (
          <form id="forgotForm" onSubmit={submitPhone}>
            <div className="field"><label>Утасны дугаар</label>
              <input name="phone" inputMode="numeric" maxLength={8} placeholder="99112233" required autoFocus defaultValue={phone} /></div>
            <button className="btn btn-lg btn-block" type="submit" id="forgotSubmit" disabled={busy}>
              {busy ? 'Илгээж байна…' : 'Код авах'}
            </button>
          </form>
        ) : (
          <>
            {mockCode ? (
              <div className="panel" style={{ background: 'var(--gold-100)', border: 'none', padding: '12px 14px', marginBottom: 14, fontSize: '.88rem' }}>
                <b>Туршилтын горим:</b> SMS тохируулаагүй тул код энд харагдаж байна — <b style={{ fontSize: '1.1rem', letterSpacing: 2 }}>{mockCode}</b>
              </div>
            ) : null}
            <form id="resetForm" onSubmit={submitReset}>
              <div className="field"><label>6 оронтой код</label>
                <input name="code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" placeholder="••••••" required autoFocus
                  style={{ letterSpacing: 6, fontSize: '1.3rem', textAlign: 'center' }} /></div>
              <div className="field"><label>Шинэ нууц үг</label>
                <input name="password" type="password" placeholder="Дор хаяж 6 тэмдэгт" required minLength={6} /></div>
              <div className="field"><label>Шинэ нууц үг давтах</label>
                <input name="password2" type="password" placeholder="••••••" required minLength={6} /></div>
              <button className="btn btn-lg btn-block" type="submit" id="resetSubmit" disabled={busy}>Нууц үг солих</button>
            </form>
            <p style={{ textAlign: 'center', margin: '12px 0 0' }}>
              <button type="button" className="link-more" id="resendLink" style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}
                onClick={() => openForgot(1, phone)}>Код дахин авах</button>
            </p>
          </>
        )}
        <p style={{ textAlign: 'center', margin: '14px 0 0' }}>
          <button type="button" className="link-more" id="backToLogin" style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}
            onClick={() => openAuth('login')}>← Нэвтрэх хуудас руу</button>
        </p>
      </div>
    </>
  );
}

export function AuthModal() {
  const { modal, closeModal } = useShop();
  return (
    <div className={`modal${modal ? ' on' : ''}`} id="modal">
      <div className="overlay modal-overlay" id="modalOverlay" onClick={closeModal} />
      <div className="modal-card">
        <button type="button" className="iconbtn modal-close" id="modalClose" aria-label="Хаах" onClick={closeModal}>
          <svg width={20} height={20}><use href="#i-x" /></svg>
        </button>
        <div id="modalContent">
          {modal?.kind === 'auth' ? <AuthForm mode={modal.mode} /> : null}
          {modal?.kind === 'forgot' ? <ForgotForm step={modal.step} phone={modal.phone} mockCode={modal.mockCode} /> : null}
        </div>
      </div>
    </div>
  );
}
