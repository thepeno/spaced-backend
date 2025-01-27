INSERT INTO
	users (id, email, password_hash)
VALUES
	(
		'test-1',
		'test@email.com',
		'Xj+SO0CHAnpDOZyhr2+KAmz1n60hDmogm+9UkmLi4p0K78+RyxWVbqT0u/TsIOBP'
	),
	(
		'test-2',
		'test2@email.com',
		'Xj+SO0CHAnpDOZyhr2+KAmz1n60hDmogm+9UkmLi4p0K78+RyxWVbqT0u/TsIOBP'
	) ON CONFLICT DO NOTHING;
