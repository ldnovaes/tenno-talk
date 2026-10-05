package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.lang.reflect.Modifier;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

/**
 * Enforces the extension rule (PLAN.md §37.2): every concrete decorator in the module has a
 * {@code <Name>ContractTest} in the same package that extends the matching contract.
 */
class EveryDecoratorHasAContractTest {

    @Test
    void everyDecoratorHasAContractTest() throws Exception {
        List<Class<?>> decorators = decorators();
        assertThat(decorators).as("decorators found in the module").hasSizeGreaterThanOrEqualTo(12);

        List<String> missing = new ArrayList<>();
        for (Class<?> decorator : decorators) {
            Class<?> contract = ScoreDecorator.class.isAssignableFrom(decorator) ? ScoreDecoratorContract.class : RerankDecoratorContract.class;
            try {
                Class<?> test = Class.forName(decorator.getName() + "ContractTest");
                if (!contract.isAssignableFrom(test)) missing.add(test.getName() + " must extend " + contract.getSimpleName());
            } catch (ClassNotFoundException absent) {
                missing.add(decorator.getName() + "ContractTest");
            }
        }
        assertThat(missing).as("missing contract tests").isEmpty();
    }

    private static List<Class<?>> decorators() throws IOException, URISyntaxException, ClassNotFoundException {
        Path classes = Path.of(ScoreDecorator.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        List<Class<?>> result = new ArrayList<>();
        try (Stream<Path> files = Files.walk(classes)) {
            for (Path file : files.filter(f -> f.toString().endsWith(".class")).toList()) {
                String name = classes.relativize(file).toString().replace(file.getFileSystem().getSeparator(), ".").replaceAll("\\.class$", "");
                Class<?> type = Class.forName(name, false, ScoreDecorator.class.getClassLoader());
                boolean decorator = ScoreDecorator.class.isAssignableFrom(type) || RerankDecorator.class.isAssignableFrom(type);
                if (decorator && !Modifier.isAbstract(type.getModifiers())) result.add(type);
            }
        }
        return result;
    }
}
