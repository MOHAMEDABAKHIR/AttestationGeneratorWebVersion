// src/components/DeclarationResultCard.jsx
import { useEffect, useMemo, useState } from "react";
import {
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    CalendarDays,
    Save,
    Link2,
    Pencil,
} from "lucide-react";

import { enrichCompany, toRecord } from "../lib/companies";
import { getSignataire } from "../lib/cabinetStore";

const TYPES = ["Sans retard", "Avec retard"];
const QUALITES = ["Expert-comptable", "Commissaire aux comptes"];

const toInputDate = (v) => {
    const d = v instanceof Date ? v : new Date(v ?? Date.now());
    if (Number.isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function Field({ label, children, hint }) {
    return (
        <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#7B0503]">
                {label}
            </span>
            <div className="mt-1">{children}</div>
            {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </label>
    );
}

function ReadOnlyField({ label, children, error }) {
    return (
        <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#7B0503]">
                {label}
            </div>
            <div
                className={`mt-1 rounded-lg border px-3 py-2 text-sm ${error
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-gray-200 bg-gray-50 text-gray-700"
                    }`}
            >
                {children || <span className="text-gray-400">—</span>}
            </div>
        </div>
    );
}

export default function DeclarationResultCard({
    extracted,
    client,
    signataire,
    onAddToSelection,
    onRequestLink,
}) {
    // --- Initialisation du formulaire depuis l'extraction + le client résolu ---
    const initial = useMemo(() => {
        const montantInitial =
            extracted?.montantNonPayeTTC != null && extracted.montantNonPayeTTC !== 0
                ? String(extracted.montantNonPayeTTC)
                : "";
        return {
            raison: extracted?.raisonSociale ?? client?.raisonSociale ?? "",
            adresse: extracted?.adresse ?? client?.adresse ?? "",
            representant: client?.representant ?? "",
            civilite: client?.civilite ?? "",
            qualiteRepresentant: client?.qualiteRepresentant ?? "",
            type: montantInitial ? "Avec retard" : "Sans retard",
            montantText: montantInitial,
            // Qualité + signataire hérités du signataire configuré
            qualite: signataire?.qualite ?? "",
            signataire: signataire?.nom ?? "",
            lieu: "Casablanca",
            date: toInputDate(new Date()), // date du jour par défaut
            sexeValue: client?.civilite ?? "",
            signataireId: signataire?.id ?? client?.signataireId ?? "",
        };
    }, [extracted, client, signataire]);

    const [form, setForm] = useState(initial);
    const [error, setError] = useState("");

    // Si le parent met à jour client/signataire (ex : ajout depuis le modal),
    // on resynchronise les champs dépendants SANS écraser les saisies utilisateur.
    useEffect(() => {
        setForm((f) => ({
            ...f,
            raison: f.raison || extracted?.raisonSociale || client?.raisonSociale || "",
            adresse: f.adresse || extracted?.adresse || client?.adresse || "",
            representant: client?.representant ?? f.representant,
            civilite: client?.civilite ?? f.civilite,
            qualiteRepresentant:
                client?.qualiteRepresentant ?? f.qualiteRepresentant,
            signataireId: signataire?.id ?? f.signataireId,
            qualite: signataire?.qualite ?? f.qualite,
            signataire: signataire?.nom ?? f.signataire,
            sexeValue: client?.civilite ?? f.sexeValue,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client?.id, signataire?.id]);

    const set = (k) => (e) => {
        const value = e.target.value;
        setForm((f) => {
            const next = { ...f, [k]: value };
            if (k === "type" && value === "Sans retard") {
                next.montantText = "";
            }
            return next;
        });
    };

    // --- Aperçu enrichi en temps réel ---
    const preview = useMemo(() => {
        const draft = {
            // Forme attendue par enrichCompany (comme un "company" Excel)
            raison: form.raison,
            adresse: form.adresse,
            representant: form.representant,
            qualiteRepresentant: form.qualiteRepresentant,
            type: form.type,
            montant: form.montantText, // enrichCompany lit c.montant pour parser
            qualite: form.qualite,
            signataire: form.signataire,
            lieu: form.lieu,
            sexe: "", // géré via sexeOverride
        };
        const dateForCalc = form.date ? new Date(form.date) : null;
        return enrichCompany(draft, form.sexeValue, form.montantText, dateForCalc);
    }, [form]);

    // --- Vérifications bloquantes ---
    const blockingErrors = useMemo(() => {
        const errs = [];
        if (!form.raison.trim()) errs.push("Raison sociale manquante.");
        if (!form.adresse.trim()) errs.push("Adresse manquante.");
        if (!form.representant.trim())
            errs.push("Nom du représentant manquant (à renseigner dans la config).");
        if (!form.sexeValue)
            errs.push("Civilité du représentant manquante (à renseigner).");
        if (!form.qualiteRepresentant.trim())
            errs.push("Qualité du représentant manquante (à renseigner).");
        if (!form.qualite)
            errs.push("Qualité du signataire manquante (configurer le client).");
        if (!form.signataire)
            errs.push("Signataire manquant (configurer le client).");
        if (!form.date) errs.push("Date de signature manquante.");
        // Erreurs venant d'enrichCompany (montant, template, date…)
        preview.errors.forEach((e) => errs.push(e));
        return errs;
    }, [form, preview.errors]);

    const canSubmit = blockingErrors.length === 0;

    // --- Soumission ---
    const handleAdd = () => {
        setError("");
        if (!canSubmit) {
            setError("Corrigez les erreurs avant d'ajouter.");
            return;
        }
        try {
            const record = toRecord(preview);
            // On garde la signature côté client pour la génération Word :
            // rien à faire ici, generateAttestation lira via cabinetStore
            // à partir de (signataire, qualite).
            onAddToSelection(record);
        } catch (err) {
            console.error(err);
            setError("Impossible de construire l'enregistrement.");
        }
    };

    const inputCls =
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#7B0503] focus:outline-none";
    const hasErrors = blockingErrors.length > 0;
    const hasWarnings = preview.warnings.length > 0;

    return (
        <section className="app-card overflow-hidden">
            {/* En-tête */}
            <div className="border-b border-[#e8eae9] px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <CalendarDays size={18} className="text-[#7B0503]" />
                        <h2 className="text-base font-semibold">
                            Résultat de l'extraction
                        </h2>
                        {preview.template && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                Template : {preview.template}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onRequestLink}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#7B0503] hover:underline"
                    >
                        <Pencil size={12} />
                        Modifier la liaison client / signataire
                    </button>
                </div>

                {/* Bandeau associé client + signataire */}
                {(client || signataire) && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
                        {client && (
                            <span className="text-blue-900">
                                Client configuré : <strong>{client.raisonSociale}</strong>
                            </span>
                        )}
                        {signataire && (
                            <span className="inline-flex items-center gap-1 text-blue-900">
                                <Link2 size={12} />
                                Signataire : <strong>{signataire.nom}</strong> (
                                {signataire.qualite})
                                {!signataire.signature && (
                                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                                        ⚠ signature manquante
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="p-6">
                {/* Erreurs et warnings */}
                {hasErrors && (
                    <div className="mb-4 space-y-1 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
                        {blockingErrors.map((m) => (
                            <p
                                key={m}
                                className="flex items-start gap-2 text-sm text-red-700"
                            >
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                {m}
                            </p>
                        ))}
                    </div>
                )}
                {hasWarnings && !hasErrors && (
                    <div className="mb-4 space-y-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                        {preview.warnings.map((m) => (
                            <p
                                key={m}
                                className="flex items-start gap-2 text-sm text-amber-800"
                            >
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                {m}
                            </p>
                        ))}
                    </div>
                )}

                {/* Grille de champs */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <Field label="Raison sociale">
                            <input
                                className={inputCls}
                                value={form.raison}
                                onChange={set("raison")}
                            />
                        </Field>
                    </div>

                    <div className="sm:col-span-2">
                        <Field label="Adresse de la société">
                            <input
                                className={inputCls}
                                value={form.adresse}
                                onChange={set("adresse")}
                            />
                        </Field>
                    </div>
                    <Field label="Nom du représentant">
                        <input
                            className={inputCls}
                            value={form.representant}
                            onChange={set("representant")}
                        />
                    </Field>

                    <Field label="Civilité du représentant">
                        <select
                            className={inputCls}
                            value={form.sexeValue}
                            onChange={set("sexeValue")}
                        >
                            <option value="">À renseigner</option>
                            <option value="H">Homme</option>
                            <option value="F">Femme</option>
                        </select>
                    </Field>

                    <div className="sm:col-span-2">

                        <Field label="Qualité du représentant">
                            <input
                                className={inputCls}
                                value={form.qualiteRepresentant}
                                onChange={set("qualiteRepresentant")}
                            />
                        </Field>
                    </div>

                    <Field label="Date de signature" hint="Détermine Exercice + Trimestre">
                        <input
                            type="date"
                            className={inputCls}
                            value={form.date}
                            onChange={set("date")}
                        />
                    </Field>

                    <ReadOnlyField
                        label="Exercice"
                        error={!preview.exercice}
                    >
                        {preview.exercice || "—"}
                    </ReadOnlyField>

                    <ReadOnlyField
                        label="Trimestre"
                        error={!preview.trimestre}
                    >
                        {preview.trimestre ? `T${preview.trimestre}` : "—"}
                    </ReadOnlyField>

                    <div className="sm:col-span-2">
                        <ReadOnlyField
                            label="Période du trimestre"
                            error={!preview.periode}
                        >
                            {preview.periode?.libelle || "—"}
                        </ReadOnlyField>
                    </div>

                    <Field label="Type d'attestation">
                        <select
                            className={inputCls}
                            value={form.type}
                            onChange={set("type")}
                        >
                            {TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label="Montant (DH)"
                        hint={
                            preview.avecRetard
                                ? "Obligatoire pour « Avec retard »"
                                : "Non requis — type « Sans retard » sélectionné"
                        }
                    >
                        <input
                            type="text"
                            inputMode="decimal"
                            className={`${inputCls} ${!preview.avecRetard
                                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                    : ""
                                }`}
                            value={form.montantText}
                            onChange={set("montantText")}
                            disabled={!preview.avecRetard}
                            placeholder={
                                preview.avecRetard ? "Ex. 12000.00" : "Non requis"
                            }
                        />
                    </Field>

                    <Field label="Qualité du signataire">
                        <select
                            className={inputCls}
                            value={form.qualite}
                            onChange={set("qualite")}
                        >
                            <option value="">— Choisir —</option>
                            {QUALITES.map((q) => (
                                <option key={q} value={q}>
                                    {q}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Nom & Prénom du signataire">
                        <input
                            className={inputCls}
                            value={form.signataire}
                            onChange={set("signataire")}
                        />
                    </Field>

                    <Field label="Lieu">
                        <input
                            className={inputCls}
                            value={form.lieu}
                            onChange={set("lieu")}
                        />
                    </Field>

                    <ReadOnlyField label="Template" error={!preview.template}>
                        {preview.template ? (
                            <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                                {preview.template}
                            </code>
                        ) : (
                            "Introuvable (vérifiez qualité + type)"
                        )}
                    </ReadOnlyField>
                </div>

                {error && (
                    <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        {error}
                    </p>
                )}

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#7B0503] px-5 py-2 text-sm font-medium text-white hover:bg-[#b80704] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Save size={16} />
                        Ajouter à la sélection
                    </button>
                </div>
            </div>
        </section>
    );
}