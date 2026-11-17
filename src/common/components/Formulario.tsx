/**
 * Formularios con react-hook-form y el esquema zod de shared/esquemas.ts (lineamientos §11): la misma
 * regla valida en la pantalla y en el servidor. Al migrar a TI, el esquema pasa a yup casi línea por línea.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { type DefaultValues, type FieldValues, type Path, type UseFormReturn, useForm } from 'react-hook-form';
import type { z, ZodTypeAny } from 'zod';

/** Lo que necesitan los campos del formulario (sin importar qué datos produce al enviar). */
export type FormularioDe<T extends FieldValues> = Pick<UseFormReturn<T>, 'register' | 'formState'>;

/** Formulario validado con un esquema zod (lo que entra: `z.input`; lo que se envía: `z.output`). */
export function useFormulario<S extends ZodTypeAny>(esquema: S, valores: DefaultValues<z.input<S>>) {
  return useForm<z.input<S>, unknown, z.output<S>>({ resolver: zodResolver(esquema), defaultValues: valores, mode: 'onSubmit' });
}

/** Mensaje de error de un campo (si lo hay). */
export function ErrorCampo<T extends FieldValues>({ form, nombre }: { form: FormularioDe<T>; nombre: Path<T> }) {
  const error = form.formState.errors[nombre];
  const mensaje = typeof error?.message === 'string' ? error.message : null;
  return mensaje ? (
    <p className="mt-1 text-xs font-medium text-rose-700" role="alert">
      {mensaje}
    </p>
  ) : null;
}

/** Campo de texto registrado en el formulario, con su etiqueta, ayuda y mensaje de error. */
export function CampoForm<T extends FieldValues>({
  form,
  nombre,
  etiqueta,
  ayuda,
  id,
  className = '',
  ...props
}: {
  form: FormularioDe<T>;
  nombre: Path<T>;
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  id?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'form' | 'id'>) {
  const idCampo = id ?? `f-${String(nombre).replace(/\./g, '-')}`;
  const conError = !!form.formState.errors[nombre];
  return (
    <div>
      <label htmlFor={idCampo} className="etiqueta">
        {etiqueta}
      </label>
      <input id={idCampo} className={`campo ${conError ? 'border-rose-400' : ''} ${className}`} aria-invalid={conError} {...props} {...form.register(nombre)} />
      {ayuda && !conError && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
      <ErrorCampo form={form} nombre={nombre} />
    </div>
  );
}

/** Error que devolvió el servidor al enviar (se muestra arriba del botón). */
export function ErrorServidor({ mensaje }: { mensaje: string | null }) {
  return mensaje ? (
    <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
      {mensaje}
    </p>
  ) : null;
}
