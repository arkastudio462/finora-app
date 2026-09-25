import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Transaction } from '@/context/FinanceContext';
import { getPaymentMethodLabel } from '@/utils/format';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildTransactionsCsv(rows: Transaction[]): string {
  const header = ['Tanggal', 'Jenis', 'Kategori', 'Metode', 'Keterangan', 'Jumlah'];
  const lines = [header.join(',')];

  for (const t of rows) {
    const d = new Date(t.date);
    const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;

    lines.push(
      [
        timestamp,
        t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        escapeCell(t.category),
        getPaymentMethodLabel(t.payment_method),
        escapeCell(t.description),
        String(t.amount),
      ].join(',')
    );
  }

  return `\uFEFF${lines.join('\n')}`;
}

export async function shareTransactionsCsv(rows: Transaction[]): Promise<string | null> {
  try {
    const csv = buildTransactionsCsv(rows);
    const now = new Date();
    const filename = `finora-transaksi-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}.csv`;
    const uri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export laporan transaksi',
        UTI: 'public.comma-separated-values-text',
      });
      return null;
    }

    await Share.share({ title: filename, message: csv });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
