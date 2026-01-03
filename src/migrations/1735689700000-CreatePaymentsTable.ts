import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePaymentsTable1735689700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE payment_status AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR');
    `);

    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'wompi_transaction_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'wompi_payment_source_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'reference',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'amount_in_cents',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'COP'",
          },
          {
            name: 'status',
            type: 'enum',
            enumName: 'payment_status',
            default: "'PENDING'",
          },
          {
            name: 'finalized_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_order_id',
        columnNames: ['order_id'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_wompi_transaction_id',
        columnNames: ['wompi_transaction_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_reference',
        columnNames: ['reference'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_payments_user_id',
      }),
    );

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'SET NULL',
        name: 'FK_payments_order_id',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payments');
    if (table) {
      const foreignKeyOrder = table.foreignKeys.find((fk) => fk.name === 'FK_payments_order_id');
      if (foreignKeyOrder) {
        await queryRunner.dropForeignKey('payments', foreignKeyOrder);
      }

      const foreignKeyUser = table.foreignKeys.find((fk) => fk.name === 'FK_payments_user_id');
      if (foreignKeyUser) {
        await queryRunner.dropForeignKey('payments', foreignKeyUser);
      }
    }

    await queryRunner.dropIndex('payments', 'IDX_payments_reference');
    await queryRunner.dropIndex('payments', 'IDX_payments_wompi_transaction_id');
    await queryRunner.dropIndex('payments', 'IDX_payments_order_id');
    await queryRunner.dropIndex('payments', 'IDX_payments_user_id');
    await queryRunner.dropTable('payments');
    await queryRunner.query(`DROP TYPE IF EXISTS payment_status;`);
  }
}

