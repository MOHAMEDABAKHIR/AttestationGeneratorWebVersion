import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { enrichCompany, readCompanies, toRecord } from "../lib/companies";
import { saveSelection } from "../lib/selectionStore";

const fmtDate = (v) => (v instanceof Date ? v.toLocaleDateString("fr-FR") : v ? String(v) : "");

function Field({ label, children, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide font-semibold text-[#7B0503] ">{label}</div>
      <div className="mt-0.5 text-sm text-gray-900">
        {children || <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

function EntrepriseDetails({ workbook, sheetName, fileName }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0); // entreprise affichée
  const [checked, setChecked] = useState({}); // { numeroLigne: true }
  const [sexes, setSexes] = useState({});
  const [montants, setMontants] = useState({});

  const companies = useMemo(
    () =>
      readCompanies(workbook, sheetName).map((c) =>
        enrichCompany(c, sexes[c.rowNumber], montants[c.rowNumber]),
      ),
    [workbook, sheetName, sexes, montants],
  );

  // Écrit la sélection (avec sexe, montant, template... à jour) dans le JSON
  useEffect(() => {
    if (!companies.length) return;
    saveSelection({
      fichier: fileName ?? "",
      feuille: sheetName,
      entreprises: companies.filter((c) => checked[c.rowNumber]).map(toRecord),
    });
  }, [companies, checked, fileName, sheetName]);

  if (!companies.length) return null;

  const current = companies[Math.min(index, companies.length - 1)];
  const selectedList = companies.filter((c) => checked[c.rowNumber]);
  const blocked = selectedList.filter((c) => c.errors.length > 0);
  const nbErreurs = companies.filter((c) => c.errors.length > 0).length;
  const nbAvert = companies.filter((c) => c.warnings.length > 0).length;
  const allChecked = companies.every((c) => checked[c.rowNumber]);

  const toggle = (id) => setChecked((s) => ({ ...s, [id]: !s[id] }));
  const toggleAll = () =>
    setChecked(allChecked ? {} : Object.fromEntries(companies.map((c) => [c.rowNumber, true])));

  const btn =
    "rounded-lg bg-[#EEEEEE] px-3 py-1 text-sm hover:bg-[#C5C1C1] disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <section className="px-6 pb-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Fiche entreprise</h2>
        <span className="text-sm text-gray-600">{companies.length} entreprise(s)</span>
        {nbErreurs > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            ⚠ {nbErreurs} erreur(s)
          </span>
        )}
        {nbAvert > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            ⚠ {nbAvert} avertissement(s)
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Liste + cases à cocher */}
        <div className="w-full shrink-0 overflow-hidden rounded-lg border border-gray-300 md:w-72">
          <label className="flex cursor-pointer items-center gap-3 border-b border-gray-300 bg-[#EEEEEE] px-3 py-2 text-sm font-medium">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4" />
            Tout sélectionner
          </label>
          <ul className="max-h-96 overflow-auto">
            {companies.map((c, i) => (
              <li
                key={c.rowNumber}
                className={`flex items-center border-b border-gray-200 ${
                  i === index ? "bg-blue-100 font-medium" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!checked[c.rowNumber]}
                  onChange={() => toggle(c.rowNumber)}
                  aria-label={`Sélectionner ${c.raison}`}
                  className="mx-3 h-4 w-4 cursor-pointer"
                />
                <button
                  onClick={() => setIndex(i)}
                  className="flex flex-1 items-center justify-between gap-2 py-2 pr-3 text-left text-sm hover:bg-blue-50"
                >
                  <span className="truncate">{c.raison}</span>
                  <span className="flex gap-1">
                    {c.errors.length > 0 && (
                      <span title={c.errors.join("\n")} className="text-red-600">⚠</span>
                    )}
                    {c.warnings.length > 0 && (
                      <span title={c.warnings.join("\n")} className="text-amber-500">⚠</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Fiche */}
        <div
          className={`flex-1 rounded-lg border p-5 ${
            current.errors.length ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
          }`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold">{current.raison}</h3>
              <p className="text-xs text-gray-500">Ligne Excel n° {current.rowNumber}</p>
            </div>
            <div className="flex gap-2">
              <button className={btn} disabled={index === 0} onClick={() => setIndex(index - 1)}>
                ‹ Précédente
              </button>
              <button
                className={btn}
                disabled={index >= companies.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Suivante ›
              </button>
            </div>
          </div>

          {(current.errors.length > 0 || current.warnings.length > 0) && (
            <div className="mb-4 space-y-2">
              {current.errors.map((m) => (
                <div key={m} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700">
                  ⚠ {m}
                </div>
              ))}
              {current.warnings.map((m) => (
                <div key={m} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  ⚠ {m}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="Adresse de la société" wide>{current.adresse}</Field>
            <Field label="Nom du PDG">
              {current.sexeValue === "F" ? "Madame " : current.sexeValue === "H" ? "Monsieur " : ""}
              {current.pdg}
            </Field>

            <div>
              <div className="text-xs font-semibold text-[#7B0503] uppercase tracking-wide ">Civilité du PDG</div>
              <select
                value={current.sexeValue}
                onChange={(e) => setSexes((s) => ({ ...s, [current.rowNumber]: e.target.value }))}
                className={`mt-0.5 rounded-lg px-2 py-1 text-sm ${
                  current.sexeValue ? "bg-[#EEEEEE]" : "border border-amber-400 bg-amber-50"
                }`}
              >
                <option value="">À renseigner</option>
                <option value="H">Homme</option>
                <option value="F">Femme</option>
              </select>
            </div>

            <Field label="Exercice">{String(current.exercice)}</Field>
            <Field label="Trimestre">{String(current.trimestre)}</Field>
            <Field label="Période du trimestre" wide>
              {current.periode?.libelle ?? <span className="text-red-600">Exercice ou trimestre invalide</span>}
            </Field>

            <Field label="Type d'attestation">
              {current.type && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    current.avecRetard ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                  }`}
                >
                  {String(current.type)}
                </span>
              )}
            </Field>

            <div>
              <div className="text-xs uppercase tracking-wide font-semibold text-[#7B0503] ">
                Montant (DH) {current.avecRetard && <span className="text-red-600">*</span>}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={current.montantText}
                onChange={(e) => setMontants((m) => ({ ...m, [current.rowNumber]: e.target.value }))}
                placeholder={current.avecRetard ? "Obligatoire" : "Doit rester vide"}
                className={`mt-0.5 w-40 rounded-lg border px-2 py-1 text-sm ${
                  current.montantError ? "border-red-500 bg-white" : "border-gray-300"
                }`}
              />
            </div>

            <Field label="Qualité du signataire">{current.qualite}</Field>
            <Field label="Nom & Prénom du signataire">{current.signataire}</Field>
            <Field label="Lieu">{current.lieu}</Field>
            <Field label="Date de signature">{fmtDate(current.date)}</Field>
            <Field label="Template" wide>
              {current.template ? (
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{current.template}</code>
              ) : (
                <span className="text-red-600">Introuvable</span>
              )}
            </Field>
          </div>
        </div>
      </div>

      {/* Barre du bas */}
      <div className="mt-4 mb-25 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {selectedList.length} entreprise(s) sélectionnée(s)
          {blocked.length > 0 && (
            <span className="ml-2 text-red-600">
              · {blocked.length} avec erreur : corrige-les ou décoche-les pour continuer
            </span>
          )}
        </p>
        <button
          className="rounded-lg bg-[#7B0503] px-5 py-2 text-sm font-medium text-white hover:bg-[#b80704] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={selectedList.length === 0 || blocked.length > 0}
          onClick={() => navigate("/selection")}
        >
          Next →
        </button>
      </div>
    </section>
  );
}

export default EntrepriseDetails;