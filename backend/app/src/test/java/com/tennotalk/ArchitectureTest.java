package com.tennotalk;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;

/** Module boundaries that the compiler cannot enforce. */
class ArchitectureTest {

    private final JavaClasses app = new ClassFileImporter().withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.tennotalk");

    /** PLAN.md §37.2: the ranking module is reached only through the discovery adapter. */
    @Test
    void onlyDiscoveryUsesTheRecommender() {
        noClasses().that().resideInAPackage("com.tennotalk..")
                .and().resideOutsideOfPackages("com.tennotalk.discovery..", "com.tennotalk.recommender..")
                .should().dependOnClassesThat().resideInAPackage("com.tennotalk.recommender..")
                .check(app);
    }
}
