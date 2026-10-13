import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { api, setToken, User } from "./api";
import { Button, Icon } from "./components";
import { pink, s } from "./styles";

type Mode = "register" | "login" | "forgot" | "reset";
export default function AuthPanel({ initialMode, initialError, onAuthenticated, onFocus }: {
  initialMode: "register" | "login"; initialError: string;
  onAuthenticated: (user: User) => void; onFocus: (input: TextInput | null) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const alive = useRef(true);
  const nameInput = useRef<TextInput>(null);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const confirmInput = useRef<TextInput>(null);
  const codeInput = useRef<TextInput>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const recovering = mode === "forgot" || mode === "reset";
  function changeMode(next: Mode) {
    if (pending.current) return;
    setMode(next); setError(""); setMessage(""); setPassword(""); setConfirmation(""); setShowPassword(false);
  }
  async function submit() {
    if (pending.current) return;
    setError(""); setMessage("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Informe um e-mail válido."); return; }
    if (mode === "register" && !name.trim()) { setError("Conte para nós o seu nome."); return; }
    if ((mode === "register" || mode === "reset") && password.length < 8) { setError("Use uma senha com pelo menos 8 caracteres."); return; }
    if (mode === "reset" && password !== confirmation) { setError("As senhas precisam ser iguais."); return; }
    if (mode === "reset" && !/^\d{8}$/.test(code)) { setError("Digite os 8 números do código recebido por e-mail."); return; }
    pending.current = true; setBusy(true);
    try {
      if (mode === "forgot") {
        const result = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
        if (alive.current) { setMode("reset"); setCode(""); setMessage(result.message); }
      } else if (mode === "reset") {
        await api("/auth/reset-password", { method: "POST", body: { email: email.trim(), code, password } });
        if (alive.current) {
          setMode("login"); setPassword(""); setConfirmation(""); setCode(""); setShowPassword(false);
          setMessage("Senha atualizada! Entre com sua nova senha."); Keyboard.dismiss();
        }
      } else {
        const result = await api<{ token: string; user: User }>(`/auth/${mode}`, {
          method: "POST", body: { name: name.trim(), email: email.trim(), password },
        });
        if (!alive.current) return;
        await setToken(result.token);
        Keyboard.dismiss(); onAuthenticated(result.user);
      }
    } catch (e) { if (alive.current) setError((e as Error).message); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  const title = mode === "register" ? "Seu próximo passo começa aqui" : mode === "login" ? "Que bom ter você de volta" : mode === "forgot" ? "Vamos recuperar seu acesso" : "Uma nova senha, um novo começo";
  return <View style={s.authCard}>
    <View style={s.authIntro}>
      <View style={s.authIcon}><Icon name={recovering ? "key-outline" : "heart-outline"} size={28} color={pink} /></View>
      <Text style={s.authEyebrow}>{recovering ? "CUIDAMOS DO SEU ACESSO" : "APRENDER. PRATICAR. EVOLUIR."}</Text>
      <Text style={s.authTitle}>{title}</Text>
      <Text style={s.authCopy}>{mode === "register" ? "Crie sua conta gratuita e tenha seu guia de posicionamento sempre por perto."
        : mode === "login" ? "Seus estudos e favoritos estão esperando por você."
          : mode === "forgot" ? "Informe o e-mail da sua conta para receber um código de recuperação."
            : "Digite o código do e-mail e escolha uma senha com pelo menos 8 caracteres."}</Text>
    </View>
    <View style={s.authBody}>
      {!recovering && <View style={s.authTabs}>
        {([['register', 'Criar conta'], ['login', 'Entrar']] as const).map(([value, label]) => <Pressable key={value}
          accessibilityRole="tab" accessibilityState={{ selected: mode === value, disabled: busy }} disabled={busy}
          onPress={() => changeMode(value)} style={[s.authTab, mode === value && s.authTabActive]}>
          <Text style={[s.authTabText, mode === value && { color: pink }]}>{label}</Text>
        </Pressable>)}
      </View>}
      {mode === "register" && <View style={s.field}>
        <Text style={s.fieldLabel}>Seu nome</Text>
        <TextInput ref={nameInput} onFocus={() => onFocus(nameInput.current)} value={name} onChangeText={setName}
          placeholder="Como podemos chamar você?" accessibilityLabel="Seu nome" style={s.input} autoComplete="name"
          editable={!busy} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailInput.current?.focus()} />
      </View>}
      <View style={s.field}>
        <Text style={s.fieldLabel}>E-mail</Text>
        <TextInput ref={emailInput} onFocus={() => onFocus(emailInput.current)} value={email} onChangeText={setEmail}
          placeholder="voce@exemplo.com" accessibilityLabel="E-mail" style={s.input} autoComplete="email" keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false} editable={!busy && mode !== "reset"} returnKeyType={mode === "forgot" ? "send" : "next"}
          submitBehavior="submit" onSubmitEditing={() => mode === "forgot" ? void submit() : passwordInput.current?.focus()} />
      </View>
      {mode === "reset" && <View style={s.field}>
        <Text style={s.fieldLabel}>Código recebido</Text>
        <TextInput ref={codeInput} onFocus={() => onFocus(codeInput.current)} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
          accessibilityLabel="Código recebido" placeholder="8 números" style={s.input} keyboardType="number-pad" autoComplete="one-time-code"
          editable={!busy} maxLength={8} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordInput.current?.focus()} />
      </View>}
      {mode !== "forgot" && <View style={s.field}>
        <Text style={s.fieldLabel}>{mode === "reset" ? "Nova senha" : "Senha"}</Text>
        <View style={s.passwordWrap}>
          <TextInput ref={passwordInput} onFocus={() => onFocus(passwordInput.current)} value={password} onChangeText={setPassword}
            accessibilityLabel={mode === "reset" ? "Nova senha" : "Senha"} style={[s.input, s.passwordInput]}
            placeholder={mode === "login" ? "Sua senha" : "Pelo menos 8 caracteres"} secureTextEntry={!showPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"} autoCapitalize="none" autoCorrect={false}
            editable={!busy} returnKeyType={mode === "reset" ? "next" : "done"}
            onSubmitEditing={() => mode === "reset" ? confirmInput.current?.focus() : void submit()} />
          <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onPress={() => setShowPassword((v) => !v)} style={{ padding: 14 }}>
            <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={pink} />
          </Pressable>
        </View>
      </View>}
      {mode === "reset" && <View style={s.field}>
        <Text style={s.fieldLabel}>Confirmar nova senha</Text>
        <TextInput ref={confirmInput} onFocus={() => onFocus(confirmInput.current)} value={confirmation} onChangeText={setConfirmation}
          accessibilityLabel="Confirmar nova senha" style={s.input} placeholder="Repita a nova senha" secureTextEntry={!showPassword}
          autoComplete="new-password" autoCapitalize="none" autoCorrect={false} editable={!busy} returnKeyType="done" onSubmitEditing={submit} />
      </View>}
      {mode === "login" && <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode("forgot")} style={s.authForgot}>
        <Text style={s.textLink}>Esqueci minha senha</Text>
      </Pressable>}
      {!!message && <Text accessibilityRole="alert" style={s.authMessage}>{message}</Text>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Button disabled={busy} label={busy ? "Aguarde..." : mode === "register" ? "Criar conta gratuita" : mode === "login" ? "Entrar" : mode === "forgot" ? "Enviar código" : "Salvar nova senha"} onPress={submit} />
      {recovering ? <>
        {mode === "reset" && <Button secondary disabled={busy} label="Reenviar código ou alterar e-mail" onPress={() => changeMode("forgot")} />}
        <Button secondary disabled={busy} label="Voltar ao login" onPress={() => changeMode("login")} />
      </> : <>
        <Text style={s.authFootnote}>{mode === "register" ? "Cadastro gratuito. O Premium é opcional." : "Seu conhecimento, sempre com você."}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode(mode === "register" ? "login" : "register")}>
          <Text style={[s.textLink, { textAlign: "center" }]}>{mode === "register" ? "Já tem uma conta? Entre aqui" : "Primeiro acesso? Crie sua conta"}</Text>
        </Pressable>
      </>}
    </View>
  </View>;
}
