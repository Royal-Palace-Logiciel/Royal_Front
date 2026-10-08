import React, { useEffect, useState } from 'react';
import { Select } from '../UI';
import { clientService, type Client } from '../../services/client.service';

interface Props {
  value: number | '';
  onChange: (clientId: number | '') => void;
}

const labelFor = (client: Client) =>
  `${client.nom}${client.prenom ? ` ${client.prenom}` : ''}${client.code_client ? ` (${client.code_client})` : ''}`;

export const BarClientSelector: React.FC<Props> = ({ value, onChange }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    clientService.getClients({ statut: 'ACTIF' })
      .then(setClients)
      .catch(() => setMessage('Impossible de charger la liste des clients.'));
  }, []);

  return (
    <div className="space-y-3">
      <Select
        label="Client"
        value={value === '' ? '' : String(value)}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : '')}
        options={[
          { value: '', label: 'Selectionner un client' },
          ...clients.map((client) => ({ value: String(client.id), label: labelFor(client) })),
        ]}
      />
      {message && <p className="text-sm text-red-400">{message}</p>}
    </div>
  );
};